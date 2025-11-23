import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageEvent, Project, User, Allocation } from 'resource-manager-database';
import {
	ResourceUsageSummaryResponseDto,
	ResourceUsageSeriesPointDto,
	ResourceUsageScopeOptionDto
} from '../dtos/resource-usage-summary.dto';
import { ResourceUsageIdentityMapperService } from './resource-usage-identity-mapper.service';

interface SummaryParams {
	scopeType?: 'user' | 'project' | 'allocation';
	scopeId?: string;
	source?: string;
}

@Injectable()
export class ResourceUsageSummaryService {
	constructor(
		@InjectRepository(ResourceUsageEvent)
		private readonly eventRepository: Repository<ResourceUsageEvent>,
		@InjectRepository(Project)
		private readonly projectRepository: Repository<Project>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Allocation)
		private readonly allocationRepository: Repository<Allocation>,
		private readonly identityMapper: ResourceUsageIdentityMapperService
	) {}

	async getSummary(params: SummaryParams): Promise<ResourceUsageSummaryResponseDto> {
		const { scopeType = 'project', scopeId, source } = params;

		// Get events for the scope
		const events = await this.getEventsForScope(scopeType, scopeId, source);

		if (events.length === 0) {
			return this.buildEmptyResponse(scopeType, scopeId);
		}

		// Get available sources from the events
		const availableSources = [...new Set(events.map((e) => e.source))].filter(Boolean);

		// Build series from events
		const series = events.map((event) => this.buildSeriesPoint(event));

		// Calculate totals
		const totals = this.calculateTotals(events);

		// Get available scopes
		const availableScopes = await this.getAvailableScopes();

		// Get current scope details
		const scopeDetails = await this.getScopeDetails(scopeType, scopeId, source);

		return {
			scope: scopeDetails,
			availableScopes,
			availableSources,
			totals,
			series
		};
	}

	private async getEventsForScope(
		scopeType: string,
		scopeId?: string,
		source?: string
	): Promise<ResourceUsageEvent[]> {
		const queryBuilder = this.eventRepository.createQueryBuilder('event').orderBy('event.time_window_start', 'ASC');

		if (scopeType === 'project' && scopeId) {
			const project = await this.projectRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});

			if (!project) {
				return [];
			}

			if (project.isPersonal) {
				// Personal project - look for events with _pbs_project_default
				// Also need to filter by user identity
				const user = await this.userRepository.findOne({
					where: { id: project.piId }
				});

				if (user) {
					queryBuilder.andWhere(
						`(event.project_name = :personalProject OR 
						 (event.project_name = :projectSlug) OR
						 EXISTS (
							SELECT 1 FROM jsonb_array_elements(event.identities) AS identity
							WHERE (identity->>'scheme' = 'oidc_sub' AND identity->>'value' = :externalId)
							   OR (identity->>'scheme' = 'user_email' AND identity->>'value' = :email)
							   OR (identity->>'scheme' = 'perun_username' AND identity->>'value' = :username)
						 ))`,
						{
							personalProject: '_pbs_project_default',
							projectSlug: project.projectSlug,
							externalId: user.externalId,
							email: user.email,
							username: user.username
						}
					);
				} else {
					queryBuilder.andWhere(
						'(event.project_name = :personalProject OR event.project_name = :projectSlug)',
						{
							personalProject: '_pbs_project_default',
							projectSlug: project.projectSlug
						}
					);
				}
			} else {
				// Regular project - match by projectSlug
				queryBuilder.andWhere('event.project_name = :projectSlug', { projectSlug: project.projectSlug });
			}
		} else if (scopeType === 'user' && scopeId) {
			const user = await this.userRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});

			if (!user) {
				return [];
			}

			// Find events matching user identities
			queryBuilder.andWhere(
				`EXISTS (
					SELECT 1 FROM jsonb_array_elements(event.identities) AS identity
					WHERE (identity->>'scheme' = 'oidc_sub' AND identity->>'value' = :externalId)
					   OR (identity->>'scheme' = 'user_email' AND identity->>'value' = :email)
					   OR (identity->>'scheme' = 'perun_username' AND identity->>'value' = :username)
				)`,
				{
					externalId: user.externalId,
					email: user.email,
					username: user.username
				}
			);
		} else {
			// No valid scope specified
			return [];
		}

		// Filter by source if provided
		if (source) {
			queryBuilder.andWhere('event.source = :source', { source });
		}

		return queryBuilder.getMany();
	}

	private buildSeriesPoint(event: ResourceUsageEvent): ResourceUsageSeriesPointDto {
		const metrics = event.metrics as any;

		return {
			timestamp: event.time_window_start.toISOString(),
			cpuTimeSeconds: metrics.cpu_time_seconds || 0,
			cpuPercent: metrics.used_cpu_percent || 0,
			walltimeSeconds: metrics.walltime_used || metrics.walltime_allocated || 0,
			ramBytesAllocated: metrics.ram_bytes_allocated || 0,
			ramBytesUsed: metrics.ram_bytes_used || 0
		};
	}

	private calculateTotals(events: ResourceUsageEvent[]) {
		if (events.length === 0) {
			return {
				totalVcpus: 0,
				storageBytesAllocated: 0,
				lastUpdated: new Date().toISOString()
			};
		}

		const latestEvent = events[events.length - 1];
		const metrics = latestEvent.metrics as any;

		return {
			totalVcpus: metrics.vcpus_allocated || 0,
			storageBytesAllocated: metrics.storage_bytes_allocated || 0,
			lastUpdated: latestEvent.collected_at.toISOString()
		};
	}

	private async getAvailableScopes(): Promise<ResourceUsageScopeOptionDto[]> {
		// Get all unique projectName values from events
		const result = await this.eventRepository
			.createQueryBuilder('event')
			.select('DISTINCT event.project_name', 'projectName')
			.addSelect('event.source', 'source')
			.where('event.project_name IS NOT NULL')
			.getRawMany<{ projectName: string; source: string }>();

		const scopes: ResourceUsageScopeOptionDto[] = [];

		// Map project names to Zeus projects
		for (const row of result) {
			// Get a sample event to get identities (for personal project user lookup)
			const sampleEvent = await this.eventRepository.findOne({
				where: { projectName: row.projectName, source: row.source }
			});

			if (!sampleEvent) continue;

			const project = await this.identityMapper.mapProjectNameToProject(
				row.projectName,
				sampleEvent.source,
				sampleEvent.identities
			);

			if (project) {
				scopes.push({
					id: project.id.toString(),
					type: 'project',
					label: project.title
				});
			}
		}

		// Deduplicate by id
		const uniqueScopes = Array.from(new Map(scopes.map((s) => [s.id, s])).values());

		return uniqueScopes;
	}

	private async getScopeDetails(
		scopeType: string,
		scopeId?: string,
		source?: string
	): Promise<ResourceUsageScopeOptionDto> {
		if (!scopeId) {
			return {
				id: '',
				type: scopeType as any,
				label: 'All',
				source
			};
		}

		if (scopeType === 'project') {
			const project = await this.projectRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});
			return {
				id: scopeId,
				type: 'project',
				label: project?.title || `Project ${scopeId}`,
				source
			};
		}

		if (scopeType === 'user') {
			const user = await this.userRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});
			return {
				id: scopeId,
				type: 'user',
				label: user?.name || user?.email || `User ${scopeId}`,
				source
			};
		}

		if (scopeType === 'allocation') {
			const allocation = await this.allocationRepository.findOne({
				where: { id: parseInt(scopeId, 10) },
				relations: ['resource']
			});
			return {
				id: scopeId,
				type: 'allocation',
				label: allocation?.resource?.name || `Allocation ${scopeId}`,
				source
			};
		}

		return {
			id: scopeId,
			type: scopeType as any,
			label: `Unknown ${scopeId}`,
			source
		};
	}

	private buildEmptyResponse(scopeType: string, scopeId?: string): ResourceUsageSummaryResponseDto {
		return {
			scope: {
				id: scopeId || '',
				type: scopeType as any,
				label: 'No data'
			},
			availableScopes: [],
			availableSources: [],
			totals: {
				totalVcpus: 0,
				storageBytesAllocated: 0,
				lastUpdated: new Date().toISOString()
			},
			series: []
		};
	}
}
