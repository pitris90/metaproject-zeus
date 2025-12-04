import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageSummary, ResourceUsageEvent, Project, User } from 'resource-manager-database';
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
		@InjectRepository(ResourceUsageSummary)
		private readonly summaryRepository: Repository<ResourceUsageSummary>,
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

		// If no summaries exist, fall back to raw events
		if (summaries.length === 0) {
			return this.getSummaryFromRawEvents(scopeType, scopeId, source, undefined);
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
	 * Used when filtering by allocationId dropdown or when no summaries exist
	 */
	private async getSummaryFromRawEvents(
		scopeType: string,
		scopeId?: string,
		source?: string,
		allocationId?: string
	): Promise<ResourceUsageSummaryResponseDto> {
		if (!scopeId) {
			return await this.buildEmptyResponse(scopeType, scopeId);
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
		// Filter by allocation/job - only for PBS jobs (OpenStack allocations are per-project)
		if (allocationId && !allocationId.startsWith('openstack-')) {
			queryBuilder.andWhere("event.context->>'jobname' = :allocationId", { allocationId });
		}
		queryBuilder.orderBy('event.time_window_start', 'ASC');
		const events = await queryBuilder.getMany();
		if (events.length === 0) {
			return await this.buildEmptyResponse(scopeType, scopeId);
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
	): Promise<ResourceUsageSummary[]> {
		const queryBuilder = this.summaryRepository
			.createQueryBuilder('summary')
			.orderBy('summary.time_window_start', 'ASC');
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
	 * Aggregate summaries by time window start, combining multiple sources into single data points
	 */
	private aggregateSeriesByDate(summaries: ResourceUsageSummary[]): ResourceUsageSeriesPointDto[] {
		// Group by time_window_start date
		const grouped = summaries.reduce(
			(acc, summary) => {
				const date =
					summary.timeWindowStart instanceof Date
						? summary.timeWindowStart
						: new Date(summary.timeWindowStart);
				const dateKey = date.toISOString().split('T')[0];
				if (!acc[dateKey]) {
					acc[dateKey] = [];
				}
				acc[dateKey].push(summary);
				return acc;
			},
			{} as Record<string, ResourceUsageSummary[]>
		);
		// Aggregate each date group
		return Object.entries(grouped)
			.map(([dateKey, daySummaries]) => {
				const date = new Date(dateKey);
				// Sum all metrics for this date
				const aggregated = daySummaries.reduce(
					(acc, s) => ({
						cpuTimeSeconds: acc.cpuTimeSeconds + (s.metrics?.cpu_time_seconds || 0),
						cpuPercent: acc.cpuPercent + (s.metrics?.cpu_percent_avg || 0),
						walltimeSeconds: acc.walltimeSeconds + (s.metrics?.walltime_seconds || 0),
						ramBytesAllocated: acc.ramBytesAllocated + (s.metrics?.ram_bytes_allocated || 0),
						ramBytesUsed: acc.ramBytesUsed + (s.metrics?.ram_bytes_used || 0),
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
	 * For PBS: Uses context->>'jobname' - each job is a separate allocation
	 * For OpenStack: There's only one "allocation" per project (the OpenStack project itself)
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

		// Get project to check if it's personal
		const project = await this.projectRepository.findOne({
			where: { id: projectId },
			select: ['id', 'isPersonal', 'title', 'projectSlug']
		});
		if (!project) {
			return [];
		}

		const allocations: ResourceUsageAllocationOptionDto[] = [];

		// Determine which sources to query
		const sourcesToQuery: string[] = source ? [source] : ['pbs', 'openstack'];

		for (const currentSource of sourcesToQuery) {
			if (currentSource === 'pbs') {
				// For PBS: Get distinct job names
				const pbsAllocations = await this.eventRepository
					.createQueryBuilder('event')
					.innerJoin('event.project', 'project')
					.select("event.context->>'jobname'", 'allocation_id')
					.where('project.id = :projectId', { projectId })
					.andWhere('event.source = :source', { source: 'pbs' })
					.andWhere("event.context->>'jobname' IS NOT NULL")
					.groupBy("event.context->>'jobname'")
					.orderBy("event.context->>'jobname'", 'ASC')
					.getRawMany<{ allocation_id: string }>();

				for (const alloc of pbsAllocations) {
					allocations.push({
						id: alloc.allocation_id,
						label: `PBS: ${alloc.allocation_id}`,
						source: 'pbs'
					});
				}
			} else if (currentSource === 'openstack') {
				// For OpenStack: Check if this project has any OpenStack events
				// If yes, show a single "OpenStack Project" option (since 1 Zeus project = 1 OpenStack project)
				const hasOpenstackEvents = await this.eventRepository
					.createQueryBuilder('event')
					.innerJoin('event.project', 'project')
					.where('project.id = :projectId', { projectId })
					.andWhere('event.source = :source', { source: 'openstack' })
					.getCount();

				if (hasOpenstackEvents > 0) {
					// For personal projects
					if (project.isPersonal) {
						allocations.push({
							id: 'openstack-personal',
							label: 'OpenStack: Personal Project',
							source: 'openstack'
						});
					} else {
						// For group projects - show the project name
						allocations.push({
							id: 'openstack-project',
							label: `OpenStack: ${project.title}`,
							source: 'openstack'
						});
					}
				}
			}
		}

		return allocations;
	}
	private async calculateTotals(summaries: ResourceUsageSummary[]) {
		if (summaries.length === 0) {
			return {
				totalVcpus: 0,
				storageBytesAllocated: 0,
				lastUpdated: new Date().toISOString()
			};
		}
		// Find the latest time window start in the summaries
		const latestDate = summaries.reduce(
			(max, s) => (new Date(s.timeWindowStart) > new Date(max) ? s.timeWindowStart : max),
			summaries[0].timeWindowStart
		);
		// Get all summaries for the latest time window (across all users/allocations for this scope)
		const latestSummaries = summaries.filter(
			(s) => new Date(s.timeWindowStart).getTime() === new Date(latestDate).getTime()
		);
		// For vCPUs, we need to query raw events from the latest timestamp
		// because summaries can't store the sum of concurrent jobs correctly
		// However, if no events exist (e.g., they were cleaned up), fall back to summary data
		let totalVcpus = 0;
		const totalStorage = latestSummaries.reduce(
			(sum, s) => sum + Number(s.metrics?.storage_bytes_allocated || 0),
			0
		);
		if (latestSummaries.length > 0) {
			const source = latestSummaries[0].source;
			const projectIds = [...new Set(latestSummaries.map((s) => s.projectId).filter(Boolean))];
			if (projectIds.length === 0) {
				// No mapped projects - use summary data directly
				totalVcpus = latestSummaries.reduce((sum, s) => sum + (s.metrics?.vcpus_allocated || 0), 0);
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
					totalVcpus = latestSummaries.reduce((sum, s) => sum + (s.metrics?.vcpus_allocated || 0), 0);
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
		const scopes: ResourceUsageScopeOptionDto[] = [];

		// First, get projects that have summaries with project_id set
		const summaryResult = await this.summaryRepository
			.createQueryBuilder('summary')
			.innerJoin('summary.project', 'project')
			.select('project.id', 'projectId')
			.addSelect('project.title', 'projectTitle')
			.addSelect('summary.source', 'source')
			.where('summary.project_id IS NOT NULL')
			.distinct(true)
			.getRawMany<{ projectId: number; projectTitle: string; source: string }>();

		for (const row of summaryResult) {
			scopes.push({
				id: row.projectId.toString(),
				type: 'project',
				label: row.projectTitle,
				source: row.source
			});
		}

		// Also get projects that have events with project_id set (even if no summaries exist)
		// This ensures we show projects that have events but haven't been aggregated yet
		const eventResult = await this.eventRepository
			.createQueryBuilder('event')
			.innerJoin('event.project', 'project')
			.select('project.id', 'projectId')
			.addSelect('project.title', 'projectTitle')
			.addSelect('event.source', 'source')
			.where('event.project_id IS NOT NULL')
			.distinct(true)
			.getRawMany<{ projectId: number; projectTitle: string; source: string }>();

		for (const row of eventResult) {
			// Only add if not already in scopes
			if (!scopes.find((s) => s.id === row.projectId.toString())) {
				scopes.push({
					id: row.projectId.toString(),
					type: 'project',
					label: row.projectTitle,
					source: row.source
				});
			}
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
	private async buildEmptyResponse(scopeType: string, scopeId?: string): Promise<ResourceUsageSummaryResponseDto> {
		// Still fetch available scopes so user can switch to a project that has data
		const availableScopes = await this.getAvailableScopes();
		const scopeDetails = await this.getScopeDetails(scopeType, scopeId);

		return {
			scope: scopeDetails,
			availableScopes,
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
