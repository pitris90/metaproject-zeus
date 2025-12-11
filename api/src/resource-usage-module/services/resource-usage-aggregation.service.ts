import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ResourceUsageEvent, ResourceUsageSummary, ResourceUsageSummaryMetrics } from 'resource-manager-database';
import { ResourceUsageProjectMapperService } from './resource-usage-project-mapper.service';

@Injectable()
export class ResourceUsageAggregationService {
	private readonly logger = new Logger(ResourceUsageAggregationService.name);

	constructor(
		@InjectRepository(ResourceUsageEvent)
		private readonly eventRepository: Repository<ResourceUsageEvent>,
		@InjectRepository(ResourceUsageSummary)
		private readonly summaryRepository: Repository<ResourceUsageSummary>,
		private readonly projectMapper: ResourceUsageProjectMapperService
	) {}

	/**
	 * Aggregate raw events into daily summaries
	 * Can be called after new events are inserted or on a schedule
	 *
	 * Groups by project_slug + source + date for project-level totals.
	 * Uses SUM for cumulative metrics, AVG for percentages.
	 *
	 * For pbsAcct source, implements cumulative aggregation:
	 * - Finds previous summary and adds current day's metrics to it
	 * - For group projects: matches by project_slug
	 * - For personal projects: matches by user identity (perun_username)
	 */
	async aggregateDailySummaries(startDate?: Date, endDate?: Date): Promise<void> {
		this.logger.log('Starting daily aggregation...');

		// First, handle personal pbsAcct events separately (per-user aggregation with cumulative logic)
		await this.aggregatePersonalPbsAcctEvents(startDate, endDate);

		// Also handle personal pbs events separately (per-user aggregation, non-cumulative)
		await this.aggregatePersonalPbsEvents(startDate, endDate);

		// Build date filter - aggregate by day and project_slug + source
		// Exclude personal pbsAcct events (they are handled separately above)
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.select('DATE(event.time_window_start)', 'summary_date')
			.addSelect('event.source', 'source')
			.addSelect('event.project_slug', 'project_slug')
			.addSelect('event.is_personal', 'is_personal')
			// Aggregated metrics - use SUM for cumulative values, AVG for percentages
			.addSelect("SUM(CAST(event.metrics->>'cpu_time_seconds' AS NUMERIC))", 'cpu_time_seconds')
			.addSelect("SUM(CAST(event.metrics->>'walltime_used' AS NUMERIC))", 'walltime_seconds')
			.addSelect("AVG(CAST(event.metrics->>'used_cpu_percent' AS NUMERIC))", 'cpu_percent_avg')
			.addSelect("SUM(CAST(event.metrics->>'ram_bytes_allocated' AS NUMERIC))", 'ram_bytes_allocated')
			.addSelect("SUM(CAST(event.metrics->>'ram_bytes_used' AS NUMERIC))", 'ram_bytes_used')
			.addSelect("SUM(CAST(event.metrics->>'storage_bytes_allocated' AS NUMERIC))", 'storage_bytes_allocated')
			.addSelect("SUM(CAST(event.metrics->>'vcpus_allocated' AS INTEGER))", 'vcpus_allocated')
			.addSelect('COUNT(*)', 'event_count')
			.addSelect('(array_agg(event.identities))[1]', 'identities')
			.where('event.project_slug IS NOT NULL')
			// Exclude personal pbs/pbsAcct events - they are handled separately per-user
			.andWhere("NOT (event.source IN ('pbs', 'pbsAcct') AND event.is_personal = true)")
			.groupBy('DATE(event.time_window_start)')
			.addGroupBy('event.source')
			.addGroupBy('event.project_slug')
			.addGroupBy('event.is_personal');

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
			// Convert summary_date to time window (start and end of that day)
			const summaryDate = new Date(row.summary_date);
			const timeWindowStart = new Date(summaryDate);
			timeWindowStart.setHours(0, 0, 0, 0);
			const timeWindowEnd = new Date(summaryDate);
			timeWindowEnd.setHours(23, 59, 59, 999);

			// For pbsAcct source, use cumulative aggregation
			if (row.source === 'pbsAcct') {
				await this.aggregatePbsAcctSummary(row, timeWindowStart, timeWindowEnd);
				continue;
			}

			// Build unique key for upsert (project_slug + source + timeWindowStart + isPersonal)
			const whereClause: Record<string, unknown> = {
				timeWindowStart,
				source: row.source,
				projectSlug: row.project_slug,
				isPersonal: row.is_personal || false
			};

			const existing = await this.summaryRepository.findOne({
				where: whereClause
			});

			if (existing) {
				// Update existing
				await this.summaryRepository.update(existing.id, {
					timeWindowEnd,
					metrics: {
						cpu_time_seconds: parseFloat(row.cpu_time_seconds) || 0,
						walltime_seconds: parseFloat(row.walltime_seconds) || 0,
						cpu_percent_avg: parseFloat(row.cpu_percent_avg) || null,
						ram_bytes_allocated: parseInt(row.ram_bytes_allocated) || 0,
						ram_bytes_used: parseInt(row.ram_bytes_used) || 0,
						storage_bytes_allocated: parseInt(row.storage_bytes_allocated) || null,
						vcpus_allocated: parseInt(row.vcpus_allocated) || null
					},
					eventCount: parseInt(row.event_count) || 0,
					identities: row.identities,
					updatedAt: new Date()
				});
			} else {
				// Create new
				const summary = this.summaryRepository.create({
					timeWindowStart,
					timeWindowEnd,
					source: row.source,
					projectSlug: row.project_slug,
					isPersonal: row.is_personal || false,
					metrics: {
						cpu_time_seconds: parseFloat(row.cpu_time_seconds) || 0,
						walltime_seconds: parseFloat(row.walltime_seconds) || 0,
						cpu_percent_avg: parseFloat(row.cpu_percent_avg) || null,
						ram_bytes_allocated: parseInt(row.ram_bytes_allocated) || 0,
						ram_bytes_used: parseInt(row.ram_bytes_used) || 0,
						storage_bytes_allocated: parseInt(row.storage_bytes_allocated) || null,
						vcpus_allocated: parseInt(row.vcpus_allocated) || null
					},
					eventCount: parseInt(row.event_count) || 0,
					identities: row.identities
				});

				await this.summaryRepository.save(summary);
			}
		}

		this.logger.log('Daily aggregation completed');

		// Map project_id for summaries that were just created/updated
		await this.mapProjectIdsToSummaries(startDate, endDate);
	}

	/**
	 * Aggregate personal events (pbs or pbsAcct) separately, grouped by user identity.
	 * Each user gets their own summary row instead of all personal users being aggregated together.
	 *
	 * @param source - 'pbs' or 'pbsAcct'
	 * @param useCumulativeLogic - If true, uses cumulative aggregation (for pbsAcct)
	 */
	private async aggregatePersonalEvents(
		source: 'pbs' | 'pbsAcct',
		useCumulativeLogic: boolean,
		startDate?: Date,
		endDate?: Date
	): Promise<void> {
		this.logger.log(`Aggregating personal ${source} events per-user...`);

		// Build query for personal events grouped by date AND user identity (perun_username)
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.select('DATE(event.time_window_start)', 'summary_date')
			.addSelect('event.source', 'source')
			.addSelect('event.project_slug', 'project_slug')
			.addSelect('event.is_personal', 'is_personal')
			// Extract perun_username from identities array for grouping
			.addSelect(
				`(SELECT identity->>'value' FROM jsonb_array_elements(event.identities) AS identity WHERE identity->>'scheme' = 'perun_username' LIMIT 1)`,
				'perun_username'
			)
			// Aggregated metrics
			.addSelect("SUM(CAST(event.metrics->>'cpu_time_seconds' AS NUMERIC))", 'cpu_time_seconds')
			.addSelect("SUM(CAST(event.metrics->>'walltime_used' AS NUMERIC))", 'walltime_seconds')
			.addSelect("AVG(CAST(event.metrics->>'used_cpu_percent' AS NUMERIC))", 'cpu_percent_avg')
			.addSelect("SUM(CAST(event.metrics->>'ram_bytes_allocated' AS NUMERIC))", 'ram_bytes_allocated')
			.addSelect("SUM(CAST(event.metrics->>'ram_bytes_used' AS NUMERIC))", 'ram_bytes_used')
			.addSelect("SUM(CAST(event.metrics->>'storage_bytes_allocated' AS NUMERIC))", 'storage_bytes_allocated')
			.addSelect("SUM(CAST(event.metrics->>'vcpus_allocated' AS INTEGER))", 'vcpus_allocated')
			.addSelect('COUNT(*)', 'event_count')
			.addSelect('(array_agg(event.identities))[1]', 'identities')
			.where('event.source = :source', { source })
			.andWhere('event.is_personal = true')
			.andWhere('event.project_slug IS NOT NULL')
			.groupBy('DATE(event.time_window_start)')
			.addGroupBy('event.source')
			.addGroupBy('event.project_slug')
			.addGroupBy('event.is_personal')
			// Group by perun_username to get per-user aggregation
			.addGroupBy(
				`(SELECT identity->>'value' FROM jsonb_array_elements(event.identities) AS identity WHERE identity->>'scheme' = 'perun_username' LIMIT 1)`
			);

		if (startDate) {
			queryBuilder.andWhere('event.time_window_start >= :startDate', { startDate });
		}

		if (endDate) {
			queryBuilder.andWhere('event.time_window_start <= :endDate', { endDate });
		}

		const aggregatedData = await queryBuilder.getRawMany();

		this.logger.log(`Found ${aggregatedData.length} personal ${source} user-day aggregations to process`);

		// Process each user-day combination
		for (const row of aggregatedData) {
			const summaryDate = new Date(row['summary_date']);
			const timeWindowStart = new Date(summaryDate);
			timeWindowStart.setHours(0, 0, 0, 0);
			const timeWindowEnd = new Date(summaryDate);
			timeWindowEnd.setHours(23, 59, 59, 999);

			if (useCumulativeLogic) {
				await this.aggregatePbsAcctSummary(row, timeWindowStart, timeWindowEnd);
			} else {
				await this.upsertPersonalSummary(row, timeWindowStart, timeWindowEnd, source);
			}
		}

		this.logger.log(`Personal ${source} per-user aggregation completed`);
	}

	/**
	 * Convenience wrapper for pbsAcct personal aggregation
	 */
	private async aggregatePersonalPbsAcctEvents(startDate?: Date, endDate?: Date): Promise<void> {
		await this.aggregatePersonalEvents('pbsAcct', true, startDate, endDate);
	}

	/**
	 * Convenience wrapper for pbs personal aggregation
	 */
	private async aggregatePersonalPbsEvents(startDate?: Date, endDate?: Date): Promise<void> {
		await this.aggregatePersonalEvents('pbs', false, startDate, endDate);
	}

	/**
	 * Extract metrics from aggregated row data.
	 */
	private extractMetricsFromRow(row: Record<string, any>): ResourceUsageSummaryMetrics {
		return {
			cpu_time_seconds: parseFloat(row['cpu_time_seconds']) || 0,
			walltime_seconds: parseFloat(row['walltime_seconds']) || 0,
			cpu_percent_avg: parseFloat(row['cpu_percent_avg']) || null,
			ram_bytes_allocated: parseInt(row['ram_bytes_allocated']) || 0,
			ram_bytes_used: parseInt(row['ram_bytes_used']) || 0,
			storage_bytes_allocated: parseInt(row['storage_bytes_allocated']) || null,
			vcpus_allocated: parseInt(row['vcpus_allocated']) || null
		};
	}

	/**
	 * Find existing personal summary by identity matching.
	 */
	private async findPersonalSummaryByIdentity(
		source: string,
		timeWindowStart: Date,
		perunUsername: string
	): Promise<ResourceUsageSummary | null> {
		return await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.source = :source', { source })
			.andWhere('summary.is_personal = :isPersonal', { isPersonal: true })
			.andWhere('summary.time_window_start = :timeWindowStart', { timeWindowStart })
			.andWhere(
				`EXISTS (
					SELECT 1 FROM jsonb_array_elements(summary.identities) AS identity
					WHERE identity->>'scheme' = 'perun_username' AND identity->>'value' = :username
				)`,
				{ username: perunUsername }
			)
			.getOne();
	}

	/**
	 * Upsert a personal summary (non-cumulative).
	 * Uses identity matching to find existing summaries for this user.
	 */
	private async upsertPersonalSummary(
		row: Record<string, any>,
		timeWindowStart: Date,
		timeWindowEnd: Date,
		source: string
	): Promise<void> {
		const identities = row['identities'] || [];
		const projectSlug = row['project_slug'];
		const perunUsername = identities.find((id: any) => id.scheme === 'perun_username')?.value;

		const metrics = this.extractMetricsFromRow(row);

		// Find existing summary by identity
		const existing = perunUsername
			? await this.findPersonalSummaryByIdentity(source, timeWindowStart, perunUsername)
			: null;

		if (existing) {
			await this.summaryRepository.update(existing.id, {
				timeWindowEnd,
				metrics,
				eventCount: parseInt(row['event_count']) || 0,
				identities,
				updatedAt: new Date()
			});
		} else {
			const summary = this.summaryRepository.create({
				timeWindowStart,
				timeWindowEnd,
				source,
				projectSlug,
				isPersonal: true,
				metrics,
				eventCount: parseInt(row['event_count']) || 0,
				identities
			});

			await this.summaryRepository.save(summary);
		}
	}

	/**
	 * Aggregate pbsAcct events with cumulative logic.
	 * Finds the most recent previous summary and adds current day's metrics to it.
	 *
	 * For group projects: matches by project_slug + source
	 * For personal projects: matches by user identity (perun_username) + isPersonal + source
	 */
	private async aggregatePbsAcctSummary(
		row: Record<string, any>,
		timeWindowStart: Date,
		timeWindowEnd: Date
	): Promise<void> {
		const isPersonal = row['is_personal'] || false;
		const projectSlug = row['project_slug'];
		const identities = row['identities'] || [];

		// Current day's metrics from events
		const currentMetrics: ResourceUsageSummaryMetrics = {
			cpu_time_seconds: parseFloat(row['cpu_time_seconds']) || 0,
			walltime_seconds: parseFloat(row['walltime_seconds']) || 0,
			cpu_percent_avg: parseFloat(row['cpu_percent_avg']) || null,
			ram_bytes_allocated: parseInt(row['ram_bytes_allocated']) || 0,
			ram_bytes_used: parseInt(row['ram_bytes_used']) || 0,
			storage_bytes_allocated: parseInt(row['storage_bytes_allocated']) || null,
			vcpus_allocated: parseInt(row['vcpus_allocated']) || null
		};

		// Find previous summary to accumulate from
		const previousSummary = await this.findPreviousPbsAcctSummary(
			timeWindowStart,
			projectSlug,
			isPersonal,
			identities
		);

		// Calculate cumulative metrics
		let cumulativeMetrics: ResourceUsageSummaryMetrics;
		if (previousSummary) {
			cumulativeMetrics = {
				cpu_time_seconds: (previousSummary.metrics?.cpu_time_seconds || 0) + currentMetrics.cpu_time_seconds,
				walltime_seconds: (previousSummary.metrics?.walltime_seconds || 0) + currentMetrics.walltime_seconds,
				cpu_percent_avg: currentMetrics.cpu_percent_avg, // Not cumulative, just current day's average
				ram_bytes_allocated:
					(previousSummary.metrics?.ram_bytes_allocated || 0) + currentMetrics.ram_bytes_allocated,
				ram_bytes_used: (previousSummary.metrics?.ram_bytes_used || 0) + currentMetrics.ram_bytes_used,
				storage_bytes_allocated: currentMetrics.storage_bytes_allocated, // Use current value, not cumulative
				vcpus_allocated: (previousSummary.metrics?.vcpus_allocated || 0) + (currentMetrics.vcpus_allocated || 0)
			};
		} else {
			// No previous summary, use current metrics as baseline
			cumulativeMetrics = currentMetrics;
		}

		// Check if summary already exists for this day
		// For personal projects, we need to match by identity (perun_username) too
		let existing: ResourceUsageSummary | null = null;

		if (isPersonal) {
			// Personal project: match by identity
			const perunUsername = identities.find((id) => id.scheme === 'perun_username')?.value;
			if (perunUsername) {
				existing = await this.summaryRepository
					.createQueryBuilder('summary')
					.where('summary.source = :source', { source: 'pbsAcct' })
					.andWhere('summary.is_personal = :isPersonal', { isPersonal: true })
					.andWhere('summary.time_window_start = :timeWindowStart', { timeWindowStart })
					.andWhere(
						`EXISTS (
							SELECT 1 FROM jsonb_array_elements(summary.identities) AS identity
							WHERE identity->>'scheme' = 'perun_username' AND identity->>'value' = :username
						)`,
						{ username: perunUsername }
					)
					.getOne();
			}
		} else {
			// Group project: match by project_slug
			existing = await this.summaryRepository.findOne({
				where: {
					timeWindowStart,
					source: 'pbsAcct',
					projectSlug,
					isPersonal: false
				}
			});
		}

		if (existing) {
			// Update existing summary with cumulative metrics
			await this.summaryRepository.update(existing.id, {
				timeWindowEnd,
				metrics: cumulativeMetrics,
				eventCount: parseInt(row['event_count']) || 0,
				identities,
				updatedAt: new Date()
			});
		} else {
			// Create new summary with cumulative metrics
			const summary = this.summaryRepository.create({
				timeWindowStart,
				timeWindowEnd,
				source: 'pbsAcct',
				projectSlug,
				isPersonal,
				metrics: cumulativeMetrics,
				eventCount: parseInt(row['event_count']) || 0,
				identities
			});

			await this.summaryRepository.save(summary);
		}
	}

	/**
	 * Find the most recent previous pbsAcct summary for cumulative aggregation.
	 *
	 * For group projects (isPersonal=false): matches by project_slug
	 * For personal projects (isPersonal=true): matches by user identity (perun_username)
	 */
	private async findPreviousPbsAcctSummary(
		currentTimeWindowStart: Date,
		projectSlug: string,
		isPersonal: boolean,
		identities: Array<{ scheme: string; value: string; authority?: string }>
	): Promise<ResourceUsageSummary | null> {
		if (!isPersonal) {
			// Group project: match by project_slug
			return await this.summaryRepository.findOne({
				where: {
					source: 'pbsAcct',
					projectSlug,
					isPersonal: false,
					timeWindowStart: LessThan(currentTimeWindowStart)
				},
				order: {
					timeWindowStart: 'DESC'
				}
			});
		}

		// Personal project: match by user identity (perun_username)
		const perunUsername = identities.find((id) => id.scheme === 'perun_username')?.value;

		if (!perunUsername) {
			this.logger.warn(`No perun_username found for personal pbsAcct summary, cannot find previous summary`);
			return null;
		}

		// Query using JSONB to match identity
		const result = await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.source = :source', { source: 'pbsAcct' })
			.andWhere('summary.is_personal = :isPersonal', { isPersonal: true })
			.andWhere('summary.time_window_start < :currentTime', { currentTime: currentTimeWindowStart })
			.andWhere(
				`EXISTS (
					SELECT 1 FROM jsonb_array_elements(summary.identities) AS identity
					WHERE identity->>'scheme' = 'perun_username' AND identity->>'value' = :username
				)`,
				{ username: perunUsername }
			)
			.orderBy('summary.time_window_start', 'DESC')
			.limit(1)
			.getOne();

		return result;
	}

	/**
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
			queryBuilder.andWhere('summary.time_window_start >= :startDate', { startDate });
		}

		if (endDate) {
			queryBuilder.andWhere('summary.time_window_start <= :endDate', { endDate });
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
