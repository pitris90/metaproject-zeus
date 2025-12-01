import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageDailySummary, ResourceUsageEvent, Project, User } from 'resource-manager-database';
import {
	ResourceUsageSummaryResponseDto,
	ResourceUsageSeriesPointDto,
	ResourceUsageScopeOptionDto,
	ResourceUsageAllocationOptionDto
} from '../dtos/resource-usage-summary.dto';

interface SummaryParams {
	scopeType?: 'user' | 'project' | 'allocation';
	scopeId?: string;
	source?: string;
	allocationId?: string;
}
@Injectable()
export class ResourceUsageSummaryService {
	constructor(
		@InjectRepository(ResourceUsageDailySummary)
		private readonly summaryRepository: Repository<ResourceUsageDailySummary>,
		@InjectRepository(ResourceUsageEvent)
		private readonly eventRepository: Repository<ResourceUsageEvent>,
		@InjectRepository(Project)
		private readonly projectRepository: Repository<Project>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {}
	async getSummary(params: SummaryParams): Promise<ResourceUsageSummaryResponseDto> {
		const { scopeType = 'project', scopeId, source, allocationId } = params;
		// When allocationId is specified, query raw events instead of aggregated summaries
		if (allocationId) {
			return this.getSummaryFromRawEvents(scopeType, scopeId, source, allocationId);
		}
		// Get summaries for the scope from aggregated table
		const summaries = await this.getSummariesForScope(scopeType, scopeId, source);
		if (summaries.length === 0) {
			return this.buildEmptyResponse(scopeType, scopeId);
		}
		// Get available sources
		const availableSources = [...new Set(summaries.map((s) => s.source))].filter(Boolean);
		// Get available allocations/jobs from raw events
		const availableAllocations = await this.getAvailableAllocations(scopeType, scopeId, source);
		// Build series from summaries and aggregate by date if multiple sources
		const series = this.aggregateSeriesByDate(summaries);
		// Calculate totals
		const totals = await this.calculateTotals(summaries);
		// Get available scopes
		const availableScopes = await this.getAvailableScopes();
		// Get current scope details
		const scopeDetails = await this.getScopeDetails(scopeType, scopeId, source);
		return {
			scope: scopeDetails,
			availableScopes,
			availableSources,
			availableAllocations,
			totals,
			series
		};
	}
	/**
	 * Get summary from raw events for a specific allocation/job
	 * Used when filtering by allocationId dropdown
	 */
	private async getSummaryFromRawEvents(
		scopeType: string,
		scopeId?: string,
		source?: string,
		allocationId?: string
	): Promise<ResourceUsageSummaryResponseDto> {
		if (!scopeId) {
			return this.buildEmptyResponse(scopeType, scopeId);
		}
		const projectId = parseInt(scopeId, 10);
		// Build query for raw events using JOIN
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.innerJoin('event.project', 'project')
			.where('project.id = :projectId', { projectId });
		// Filter by source
		if (source) {
			queryBuilder.andWhere('event.source = :source', { source });
		}
		// Filter by allocation/job
		if (allocationId) {
			queryBuilder.andWhere("event.context->>'jobname' = :allocationId", { allocationId });
		}
		queryBuilder.orderBy('event.time_window_start', 'ASC');
		const events = await queryBuilder.getMany();
		if (events.length === 0) {
			return this.buildEmptyResponse(scopeType, scopeId);
		}
		// Aggregate events by date
		const dailyAggregates = this.aggregateEventsByDate(events);
		// Get available sources and allocations
		const availableSources = [...new Set(events.map((e) => e.source))].filter(Boolean);
		const availableAllocations = await this.getAvailableAllocations(scopeType, scopeId, source);
		// Calculate totals from events (similar to summary-based calculation)
		const latestEvents = events.filter(
			(e) => e.time_window_start.getTime() === events[events.length - 1].time_window_start.getTime()
		);
		const totals = {
			totalVcpus: latestEvents.reduce((sum, e) => sum + (e.metrics.vcpus_allocated || 0), 0),
			storageBytesAllocated: latestEvents.reduce((sum, e) => sum + (e.metrics.storage_bytes_allocated || 0), 0),
			lastUpdated: events[events.length - 1]?.time_window_start?.toISOString() || new Date().toISOString()
		};
		// Get available scopes
		const availableScopes = await this.getAvailableScopes();
		// Get current scope details
		const scopeDetails = await this.getScopeDetails(scopeType, scopeId, source);
		return {
			scope: scopeDetails,
			availableScopes,
			availableSources,
			availableAllocations,
			totals,
			series: dailyAggregates
		};
	}
	/**
	 * Aggregate raw events by date
	 */
	private aggregateEventsByDate(events: ResourceUsageEvent[]): ResourceUsageSeriesPointDto[] {
		// Group by date
		const grouped = events.reduce(
			(acc, event) => {
				const date =
					event.time_window_start instanceof Date
						? event.time_window_start
						: new Date(event.time_window_start);
				const dateKey = date.toISOString().split('T')[0];
				if (!acc[dateKey]) {
					acc[dateKey] = [];
				}
				acc[dateKey].push(event);
				return acc;
			},
			{} as Record<string, ResourceUsageEvent[]>
		);
		// Aggregate each date group
		return Object.entries(grouped)
			.map(([dateKey, dayEvents]) => {
				const date = new Date(dateKey);
				// Sum all metrics for this date
				const aggregated = dayEvents.reduce(
					(acc, e) => {
						const metrics = e.metrics as any;
						return {
							cpuTimeSeconds: acc.cpuTimeSeconds + (metrics?.cpu_time_seconds || 0),
							cpuPercent: acc.cpuPercent + (metrics?.used_cpu_percent || 0),
							walltimeSeconds: acc.walltimeSeconds + (metrics?.walltime_used || 0),
							ramBytesAllocated: acc.ramBytesAllocated + (metrics?.ram_bytes_allocated || 0),
							ramBytesUsed: acc.ramBytesUsed + (metrics?.ram_bytes_used || 0),
							count: acc.count + 1
						};
					},
					{
						cpuTimeSeconds: 0,
						cpuPercent: 0,
						walltimeSeconds: 0,
						ramBytesAllocated: 0,
						ramBytesUsed: 0,
						count: 0
					}
				);
				// Average the CPU percent
				const avgCpuPercent = aggregated.count > 0 ? aggregated.cpuPercent / aggregated.count : 0;
				return {
					timestamp: date.toISOString(),
					cpuTimeSeconds: aggregated.cpuTimeSeconds,
					cpuPercent: avgCpuPercent,
					walltimeSeconds: aggregated.walltimeSeconds,
					ramBytesAllocated: aggregated.ramBytesAllocated,
					ramBytesUsed: aggregated.ramBytesUsed
				};
			})
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
	}
	private async getSummariesForScope(
		scopeType: string,
		scopeId?: string,
		source?: string
	): Promise<ResourceUsageDailySummary[]> {
		const queryBuilder = this.summaryRepository
			.createQueryBuilder('summary')
			.orderBy('summary.summary_date', 'ASC');
		if (scopeType === 'project' && scopeId) {
			const projectId = parseInt(scopeId, 10);
			// Use JOIN to query by project_id
			queryBuilder.innerJoin('summary.project', 'project').where('project.id = :projectId', { projectId });
		} else if (scopeType === 'user' && scopeId) {
			const user = await this.userRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});
			if (!user) {
				return [];
			}
			queryBuilder.andWhere(
				`EXISTS (
					SELECT 1 FROM jsonb_array_elements(summary.identities) AS identity
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
			return [];
		}
		// Filter by source if provided
		if (source) {
			queryBuilder.andWhere('summary.source = :source', { source });
		}
		return queryBuilder.getMany();
	}
	/**
	 * Aggregate summaries by date, combining multiple sources into single data points per day
	 */
	private aggregateSeriesByDate(summaries: ResourceUsageDailySummary[]): ResourceUsageSeriesPointDto[] {
		// Group by date
		const grouped = summaries.reduce(
			(acc, summary) => {
				const date = summary.summaryDate instanceof Date ? summary.summaryDate : new Date(summary.summaryDate);
				const dateKey = date.toISOString().split('T')[0];
				if (!acc[dateKey]) {
					acc[dateKey] = [];
				}
				acc[dateKey].push(summary);
				return acc;
			},
			{} as Record<string, ResourceUsageDailySummary[]>
		);
		// Aggregate each date group
		return Object.entries(grouped)
			.map(([dateKey, daySummaries]) => {
				const date = new Date(dateKey);
				// Sum all metrics for this date
				const aggregated = daySummaries.reduce(
					(acc, s) => ({
						cpuTimeSeconds: acc.cpuTimeSeconds + (s.cpuTimeSeconds || 0),
						cpuPercent: acc.cpuPercent + (s.cpuPercentAvg || 0),
						walltimeSeconds: acc.walltimeSeconds + (s.walltimeSeconds || 0),
						ramBytesAllocated: acc.ramBytesAllocated + (s.ramBytesAllocated || 0),
						ramBytesUsed: acc.ramBytesUsed + (s.ramBytesUsed || 0),
						count: acc.count + 1
					}),
					{
						cpuTimeSeconds: 0,
						cpuPercent: 0,
						walltimeSeconds: 0,
						ramBytesAllocated: 0,
						ramBytesUsed: 0,
						count: 0
					}
				);
				// Average the CPU percent (since it's a percentage, not a sum)
				const avgCpuPercent = aggregated.count > 0 ? aggregated.cpuPercent / aggregated.count : 0;
				return {
					timestamp: date.toISOString(),
					cpuTimeSeconds: aggregated.cpuTimeSeconds,
					cpuPercent: avgCpuPercent,
					walltimeSeconds: aggregated.walltimeSeconds,
					ramBytesAllocated: aggregated.ramBytesAllocated,
					ramBytesUsed: aggregated.ramBytesUsed
				};
			})
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
	}
	/**
	 * Get available allocations/jobs from raw events table
	 * Queries the resource_usage_events table to get distinct job names or allocation identifiers
	 * For PBS (personal & group): Uses context->>'jobname'
	 * For OpenStack group projects: Uses project_slug
	 * For OpenStack personal projects: Shows "Personal Project" (filters by user's externalId)
	 */
	private async getAvailableAllocations(
		scopeType: string,
		scopeId?: string,
		source?: string
	): Promise<ResourceUsageAllocationOptionDto[]> {
		if (!scopeId) {
			return [];
		}
		const projectId = parseInt(scopeId, 10);
		const effectiveSource = source || 'pbs';
		// Get project to check if it's personal
		const project = await this.projectRepository.findOne({
			where: { id: projectId },
			select: ['id', 'isPersonal']
		});
		if (!project) {
			return [];
		}
		// For OpenStack personal projects, return a single "Personal Project" option
		if (effectiveSource === 'openstack' && project.isPersonal) {
			return [
				{
					id: 'personal',
					label: 'OpenStack: Personal Project',
					source: 'openstack'
				}
			];
		}
		// For PBS (both personal & group) and OpenStack group projects
		// PBS: Use context->>'jobname'
		// OpenStack group: Use project_slug
		const allocationField = effectiveSource === 'pbs' ? "event.context->>'jobname'" : 'event.project_slug';
		// Query raw events for distinct allocation identifiers using JOIN
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.innerJoin('event.project', 'project')
			.select(allocationField, 'allocation_id')
			.addSelect('event.source', 'source')
			.where('project.id = :projectId', { projectId });
		queryBuilder
			.andWhere('event.source = :source', { source: effectiveSource })
			.andWhere(`${allocationField} IS NOT NULL`)
			.groupBy('allocation_id')
			.addGroupBy('event.source')
			.orderBy('event.source', 'ASC')
			.addOrderBy('allocation_id', 'ASC');
		const allocations = await queryBuilder.getRawMany<{ allocation_id: string; source: string }>();
		return allocations.map((alloc) => ({
			id: alloc.allocation_id,
			label: alloc.source === 'pbs' ? `PBS: ${alloc.allocation_id}` : `OpenStack: ${alloc.allocation_id}`,
			source: alloc.source
		}));
	}
	private async calculateTotals(summaries: ResourceUsageDailySummary[]) {
		if (summaries.length === 0) {
			return {
				totalVcpus: 0,
				storageBytesAllocated: 0,
				lastUpdated: new Date().toISOString()
			};
		}
		// Find the latest date in the summaries
		const latestDate = summaries.reduce(
			(max, s) => (new Date(s.summaryDate) > new Date(max) ? s.summaryDate : max),
			summaries[0].summaryDate
		);
		// Get all summaries for the latest date (across all users/allocations for this scope)
		const latestSummaries = summaries.filter(
			(s) => new Date(s.summaryDate).getTime() === new Date(latestDate).getTime()
		);
		// For vCPUs, we need to query raw events from the latest timestamp
		// because summaries can't store the sum of concurrent jobs correctly
		// However, if no events exist (e.g., they were cleaned up), fall back to summary data
		let totalVcpus = 0;
		const totalStorage = latestSummaries.reduce((sum, s) => sum + Number(s.storageBytesAllocated || 0), 0);
		if (latestSummaries.length > 0) {
			const source = latestSummaries[0].source;
			const projectIds = [...new Set(latestSummaries.map((s) => s.projectId).filter(Boolean))];
			if (projectIds.length === 0) {
				// No mapped projects - use summary data directly
				totalVcpus = latestSummaries.reduce((sum, s) => sum + (s.vcpusAllocated || 0), 0);
			} else {
				// Find the latest timestamp for this scope
				const latestTimeQuery = this.eventRepository
					.createQueryBuilder('event')
					.innerJoin('event.project', 'project')
					.select('MAX(event.time_window_start)', 'latest_time')
					.where('project.id IN (:...projectIds)', { projectIds })
					.andWhere('event.source = :source', { source });
				const latestTimeResult = await latestTimeQuery.getRawOne<{ latest_time: Date }>();
				if (latestTimeResult?.latest_time) {
					// Sum vCPUs from all events at the latest timestamp for this scope
					const vcpuQuery = this.eventRepository
						.createQueryBuilder('event')
						.innerJoin('event.project', 'project')
						.select("SUM(CAST(event.metrics->'vcpus_allocated' AS INTEGER))", 'total_vcpus')
						.where('event.time_window_start = :latestTime', { latestTime: latestTimeResult.latest_time })
						.andWhere('project.id IN (:...projectIds)', { projectIds })
						.andWhere('event.source = :source', { source });
					const vcpuResult = await vcpuQuery.getRawOne<{ total_vcpus: number }>();
					totalVcpus = Number(vcpuResult?.total_vcpus) || 0;
				}
				// Fallback: If no events found (cleaned up or never existed), use summary data
				if (totalVcpus === 0) {
					totalVcpus = latestSummaries.reduce((sum, s) => sum + (s.vcpusAllocated || 0), 0);
				}
			}
		}
		return {
			totalVcpus,
			storageBytesAllocated: Number(totalStorage),
			lastUpdated:
				latestSummaries[latestSummaries.length - 1]?.updatedAt.toISOString() || new Date().toISOString()
		};
	}
	private async getAvailableScopes(): Promise<ResourceUsageScopeOptionDto[]> {
		// Get all unique projects that have summaries with project_id set
		const result = await this.summaryRepository
			.createQueryBuilder('summary')
			.innerJoin('summary.project', 'project')
			.select('project.id', 'projectId')
			.addSelect('project.title', 'projectTitle')
			.addSelect('summary.source', 'source')
			.where('summary.project_id IS NOT NULL')
			.distinct(true)
			.getRawMany<{ projectId: number; projectTitle: string; source: string }>();
		const scopes: ResourceUsageScopeOptionDto[] = [];
		for (const row of result) {
			scopes.push({
				id: row.projectId.toString(),
				type: 'project',
				label: row.projectTitle,
				source: row.source
			});
		}
		// Deduplicate by id
		return Array.from(new Map(scopes.map((s) => [s.id, s])).values());
	}
	private async getScopeDetails(
		scopeType: string,
		scopeId?: string,
		source?: string
	): Promise<ResourceUsageScopeOptionDto> {
		if (scopeType === 'project' && scopeId) {
			const project = await this.projectRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});
			if (project) {
				return {
					id: project.id.toString(),
					type: 'project',
					label: project.title,
					source
				};
			}
		} else if (scopeType === 'user' && scopeId) {
			const user = await this.userRepository.findOne({
				where: { id: parseInt(scopeId, 10) }
			});
			if (user) {
				return {
					id: user.id.toString(),
					type: 'user',
					label: user.name || user.email,
					source
				};
			}
		}
		return {
			id: scopeId || 'unknown',
			type: scopeType as any,
			label: 'Unknown scope'
		};
	}
	private buildEmptyResponse(scopeType: string, scopeId?: string): ResourceUsageSummaryResponseDto {
		return {
			scope: {
				id: scopeId || 'unknown',
				type: scopeType as any,
				label: 'Unknown scope'
			},
			availableScopes: [],
			availableSources: [],
			availableAllocations: [],
			totals: {
				totalVcpus: 0,
				storageBytesAllocated: 0,
				lastUpdated: new Date().toISOString()
			},
			series: []
		};
	}
}
