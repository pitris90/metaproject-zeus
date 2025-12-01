import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageEvent, ResourceUsageDailySummary } from 'resource-manager-database';
import { ResourceUsageProjectMapperService } from './resource-usage-project-mapper.service';

@Injectable()
export class ResourceUsageAggregationService {
	private readonly logger = new Logger(ResourceUsageAggregationService.name);

	constructor(
		@InjectRepository(ResourceUsageEvent)
		private readonly eventRepository: Repository<ResourceUsageEvent>,
		@InjectRepository(ResourceUsageDailySummary)
		private readonly summaryRepository: Repository<ResourceUsageDailySummary>,
		private readonly projectMapper: ResourceUsageProjectMapperService
	) {}

	/**
	 * Aggregate raw events into daily summaries
	 * Can be called after new events are inserted or on a schedule
	 *
	 * Special handling:
	 * - PBS personal projects (_pbs_project_default with is_personal=true): Group by user identity
	 * - All other projects: Group by project_slug
	 */
	async aggregateDailySummaries(startDate?: Date, endDate?: Date): Promise<void> {
		this.logger.log('Starting daily aggregation...');

		// Build date filter
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.select('DATE(event.time_window_start)', 'summary_date')
			.addSelect('event.source', 'source')
			.addSelect('event.project_slug', 'project_slug')
			.addSelect('event.is_personal', 'is_personal')
			// For PBS personal projects, extract user identifier from identities
			// For other projects, use NULL as user_identifier
			.addSelect(
				`CASE 
					WHEN event.is_personal = true THEN 
						COALESCE(
							(SELECT identity->>'value' FROM jsonb_array_elements(event.identities) AS identity WHERE identity->>'scheme' = 'oidc_sub' LIMIT 1),
							(SELECT identity->>'value' FROM jsonb_array_elements(event.identities) AS identity WHERE identity->>'scheme' = 'user_email' LIMIT 1),
							(SELECT identity->>'value' FROM jsonb_array_elements(event.identities) AS identity WHERE identity->>'scheme' = 'perun_username' LIMIT 1)
						)
					ELSE NULL
				END`,
				'user_identifier'
			)
			.addSelect("SUM(CAST(event.metrics->>'cpu_time_seconds' AS NUMERIC))", 'cpu_time_seconds')
			.addSelect("SUM(CAST(event.metrics->>'walltime_used' AS NUMERIC))", 'walltime_seconds')
			.addSelect("AVG(CAST(event.metrics->>'used_cpu_percent' AS NUMERIC))", 'cpu_percent_avg')
			.addSelect("SUM(CAST(event.metrics->>'ram_bytes_allocated' AS NUMERIC))", 'ram_bytes_allocated')
			.addSelect("SUM(CAST(event.metrics->>'ram_bytes_used' AS NUMERIC))", 'ram_bytes_used')
			.addSelect("SUM(CAST(event.metrics->>'storage_bytes_allocated' AS NUMERIC))", 'storage_bytes_allocated')
			// For vCPUs: Store the SUM of all vCPUs from all events for this user on this day
			// When displaying totals, we'll query from latest timestamp via calculateTotals()
			.addSelect("SUM(CAST(event.metrics->>'vcpus_allocated' AS INTEGER))", 'vcpus_allocated')
			.addSelect('COUNT(*)', 'event_count')
			.addSelect('(array_agg(event.identities))[1]', 'identities')
			.where('event.project_slug IS NOT NULL')
			.groupBy('DATE(event.time_window_start)')
			.addGroupBy('event.source')
			.addGroupBy('event.project_slug')
			.addGroupBy('event.is_personal')
			.addGroupBy('user_identifier');

		if (startDate) {
			queryBuilder.andWhere('event.time_window_start >= :startDate', { startDate });
		}

		if (endDate) {
			queryBuilder.andWhere('event.time_window_start <= :endDate', { endDate });
		}

		const aggregatedData = await queryBuilder.getRawMany();

		this.logger.log(`Found ${aggregatedData.length} daily aggregations to process`);

		// Upsert aggregated data
		for (const row of aggregatedData) {
			// Build unique key
			const whereClause: any = {
				summaryDate: row.summary_date,
				source: row.source,
				projectSlug: row.project_slug,
				isPersonal: row.is_personal || false
			};

			// For personal projects, include user_identifier in the unique key
			if (row.user_identifier) {
				whereClause.allocationIdentifier = row.user_identifier;
			} else {
				whereClause.allocationIdentifier = null;
			}

			const existing = await this.summaryRepository.findOne({
				where: whereClause
			});

			if (existing) {
				// Update existing
				await this.summaryRepository.update(existing.id, {
					isPersonal: row.is_personal || false,
					cpuTimeSeconds: parseFloat(row.cpu_time_seconds) || 0,
					walltimeSeconds: parseFloat(row.walltime_seconds) || 0,
					cpuPercentAvg: parseFloat(row.cpu_percent_avg) || null,
					ramBytesAllocated: parseInt(row.ram_bytes_allocated) || 0,
					ramBytesUsed: parseInt(row.ram_bytes_used) || 0,
					storageBytesAllocated: parseInt(row.storage_bytes_allocated) || null,
					vcpusAllocated: parseInt(row.vcpus_allocated) || null,
					eventCount: parseInt(row.event_count) || 0,
					identities: row.identities,
					updatedAt: new Date()
				});
			} else {
				// Create new
				const summary = this.summaryRepository.create({
					summaryDate: row.summary_date,
					source: row.source,
					projectSlug: row.project_slug,
					isPersonal: row.is_personal || false,
					allocationIdentifier: row.user_identifier || null,
					cpuTimeSeconds: parseFloat(row.cpu_time_seconds) || 0,
					walltimeSeconds: parseFloat(row.walltime_seconds) || 0,
					cpuPercentAvg: parseFloat(row.cpu_percent_avg) || null,
					ramBytesAllocated: parseInt(row.ram_bytes_allocated) || 0,
					ramBytesUsed: parseInt(row.ram_bytes_used) || 0,
					storageBytesAllocated: parseInt(row.storage_bytes_allocated) || null,
					vcpusAllocated: parseInt(row.vcpus_allocated) || null,
					eventCount: parseInt(row.event_count) || 0,
					identities: row.identities
				});

				await this.summaryRepository.save(summary);
			}
		}

		this.logger.log('Daily aggregation completed');

		// Map project_id for summaries that were just created/updated
		await this.mapProjectIdsToSummaries(startDate, endDate);
	} /**
	 * Aggregate only for specific dates (used when new events are received)
	 * More efficient than re-aggregating all data
	 */
	async aggregateForDates(dates: Date[]): Promise<void> {
		if (dates.length === 0) {
			return;
		}

		this.logger.log(`Aggregating for ${dates.length} specific dates`);

		const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
		const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
		// Set maxDate to end of day to include all events on that date
		maxDate.setHours(23, 59, 59, 999);

		await this.aggregateDailySummaries(minDate, maxDate);
	}

	/**
	 * Aggregate for a specific project
	 */
	async aggregateForProject(projectSlug: string, source?: string): Promise<void> {
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.where('event.project_slug = :projectSlug', { projectSlug });

		if (source) {
			queryBuilder.andWhere('event.source = :source', { source });
		}

		const events = await queryBuilder.getMany();

		if (events.length === 0) {
			return;
		}

		const minDate = new Date(Math.min(...events.map((e) => e.time_window_start.getTime())));
		const maxDate = new Date(Math.max(...events.map((e) => e.time_window_start.getTime())));

		await this.aggregateDailySummaries(minDate, maxDate);
	}

	/**
	 * Map project_id to summaries by looking up projects and applying same mapping logic
	 * This is called after aggregation to populate project_id for newly aggregated summaries
	 */
	private async mapProjectIdsToSummaries(startDate?: Date, endDate?: Date): Promise<void> {
		this.logger.log('Mapping project IDs to summaries...');

		const queryBuilder = this.summaryRepository.createQueryBuilder('summary').where('summary.project_id IS NULL');

		if (startDate) {
			queryBuilder.andWhere('summary.summary_date >= :startDate', { startDate });
		}

		if (endDate) {
			queryBuilder.andWhere('summary.summary_date <= :endDate', { endDate });
		}

		const unmappedSummaries = await queryBuilder.getMany();

		this.logger.log(`Found ${unmappedSummaries.length} unmapped summaries`);

		for (const summary of unmappedSummaries) {
			try {
				// Use the consolidated mapper with all parameters
				const projectId = await this.projectMapper.mapEventToProject(
					summary.projectSlug,
					summary.source,
					summary.isPersonal,
					summary.identities || []
				);

				if (projectId) {
					await this.summaryRepository.update(summary.id, { projectId });
				}
			} catch (error) {
				this.logger.error(`Failed to map project ID for summary ${summary.id}`, error);
			}
		}

		this.logger.log('Project ID mapping completed');
	}
}
