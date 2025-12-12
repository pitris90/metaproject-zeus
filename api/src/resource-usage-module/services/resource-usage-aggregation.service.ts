import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
	ResourceUsageEvent,
	ResourceUsageSummary,
	ResourceUsageSummaryMetrics,
	OpenstackInstanceMetrics,
	ResourceUsageSummaryExtra
} from 'resource-manager-database';
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

		// 1. Personal PBS events (per-user, cumulative)
		await this.aggregatePersonalPbsAcctEvents(startDate, endDate);

		// 2. Personal PBS events (per-user, non-cumulative)
		await this.aggregatePersonalPbsEvents(startDate, endDate);

		// 3. OpenStack events (per-instance cumulative)
		await this.aggregateOpenstackEvents(startDate, endDate);

		// 4. General events (everything else: group PBS, other sources)
		await this.aggregateGeneralEvents(startDate, endDate);

		this.logger.log('Daily aggregation completed');

		// Map project_id for summaries that were just created/updated
		await this.mapProjectIdsToSummaries(startDate, endDate);
	}

	/**
	 * Aggregate general events (group PBS, and any other non-specialized sources).
	 * Excludes: personal PBS/pbsAcct (handled per-user) and OpenStack (handled per-instance).
	 */
	private async aggregateGeneralEvents(startDate?: Date, endDate?: Date): Promise<void> {
		this.logger.log('Aggregating general events (group PBS and other sources)...');

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
			// Exclude personal pbs/pbsAcct - handled by aggregatePersonalEvents
			.andWhere("NOT (event.source IN ('pbs', 'pbsAcct') AND event.is_personal = true)")
			// Exclude openstack - handled by aggregateOpenstackEvents
			.andWhere("event.source != 'openstack'")
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

		this.logger.log(`Found ${aggregatedData.length} general aggregations to process`);

		for (const row of aggregatedData) {
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

			// Standard upsert for other sources
			const whereClause: Record<string, unknown> = {
				timeWindowStart,
				source: row.source,
				projectSlug: row.project_slug,
				isPersonal: row.is_personal || false
			};

			const existing = await this.summaryRepository.findOne({
				where: whereClause
			});

			const metrics = this.extractMetricsFromRow(row);

			if (existing) {
				await this.summaryRepository.update(existing.id, {
					timeWindowEnd,
					metrics,
					eventCount: parseInt(row.event_count) || 0,
					identities: row.identities,
					updatedAt: new Date()
				});
			} else {
				const summary = this.summaryRepository.create({
					timeWindowStart,
					timeWindowEnd,
					source: row.source,
					projectSlug: row.project_slug,
					isPersonal: row.is_personal || false,
					metrics,
					eventCount: parseInt(row.event_count) || 0,
					identities: row.identities
				});

				await this.summaryRepository.save(summary);
			}
		}

		this.logger.log('General events aggregation completed');
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
	 * Find existing summary by identity matching (supports multiple schemes).
	 * Uses extractPrimaryUserIdentity to find the best identity for matching.
	 */
	private async findSummaryByIdentity(
		source: string,
		timeWindowStart: Date,
		isPersonal: boolean,
		identities: Array<{ scheme: string; value: string; authority?: string }>
	): Promise<ResourceUsageSummary | null> {
		if (!isPersonal) {
			return null; // Group projects don't use identity matching
		}

		const userIdentity = this.extractPrimaryUserIdentity(identities);
		if (!userIdentity) {
			return null;
		}

		return await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.source = :source', { source })
			.andWhere('summary.is_personal = :isPersonal', { isPersonal: true })
			.andWhere('summary.time_window_start = :timeWindowStart', { timeWindowStart })
			.andWhere(
				`EXISTS (
					SELECT 1 FROM jsonb_array_elements(summary.identities) AS identity
					WHERE identity->>'scheme' = :scheme AND identity->>'value' = :value
				)`,
				{ scheme: userIdentity.scheme, value: userIdentity.value }
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
		const metrics = this.extractMetricsFromRow(row);

		// Find existing summary by identity (supports multiple schemes)
		const existing = await this.findSummaryByIdentity(source, timeWindowStart, true, identities);

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
		const currentMetrics = this.extractMetricsFromRow(row);

		// Find previous summary to accumulate from
		const previousSummary = await this.findPreviousSummary(
			'pbsAcct',
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
		// For personal projects, use identity matching; for group projects, use project_slug
		let existing: ResourceUsageSummary | null = null;

		if (isPersonal) {
			// Personal project: match by identity (supports multiple schemes)
			existing = await this.findSummaryByIdentity('pbsAcct', timeWindowStart, true, identities);
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
	 * Find the most recent previous summary for cumulative aggregation.
	 * Works for any source (pbsAcct, openstack, etc.).
	 *
	 * For group projects (isPersonal=false): matches by project_slug + source
	 * For personal projects (isPersonal=true): matches by user identity (perun_username) + source
	 *
	 * @param source - The source type (e.g., 'pbsAcct', 'openstack')
	 * @param currentTimeWindowStart - Find summaries before this date
	 * @param projectSlug - Project slug to match
	 * @param isPersonal - Whether this is a personal project
	 * @param identities - User identities (required for personal project matching)
	 */
	private async findPreviousSummary(
		source: string,
		currentTimeWindowStart: Date,
		projectSlug: string,
		isPersonal: boolean,
		identities?: Array<{ scheme: string; value: string; authority?: string }>
	): Promise<ResourceUsageSummary | null> {
		if (!isPersonal) {
			// Group project: match by project_slug + source
			return await this.summaryRepository.findOne({
				where: {
					source,
					projectSlug,
					isPersonal: false,
					timeWindowStart: LessThan(currentTimeWindowStart)
				},
				order: {
					timeWindowStart: 'DESC'
				}
			});
		}

		// Personal project: find a suitable user identity to match on
		const userIdentity = this.extractPrimaryUserIdentity(identities);

		if (!userIdentity) {
			this.logger.warn(`No user identity found for personal ${source} summary, cannot find previous summary`);
			return null;
		}

		// Query using JSONB to match identity - uses the same scheme to ensure consistency
		const result = await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.source = :source', { source })
			.andWhere('summary.is_personal = :isPersonal', { isPersonal: true })
			.andWhere('summary.time_window_start < :currentTime', { currentTime: currentTimeWindowStart })
			.andWhere(
				`EXISTS (
					SELECT 1 FROM jsonb_array_elements(summary.identities) AS identity
					WHERE identity->>'scheme' = :scheme AND identity->>'value' = :value
				)`,
				{ scheme: userIdentity.scheme, value: userIdentity.value }
			)
			.orderBy('summary.time_window_start', 'DESC')
			.limit(1)
			.getOne();

		return result;
	}

	/**
	 * Priority order for user identity schemes.
	 * More specific/reliable schemes come first.
	 */
	private static readonly USER_IDENTITY_SCHEMES = [
		'perun_username', // PBS: unique MetaCentrum username
		'oidc_sub', // OpenStack: OIDC subject identifier
		'user_email' // Fallback: email address
	];

	/**
	 * Extract the primary user identity from a list of identities.
	 * Tries schemes in priority order to find the best match.
	 *
	 * @param identities - Array of identity objects
	 * @returns The first matching identity or null if none found
	 */
	private extractPrimaryUserIdentity(
		identities?: Array<{ scheme: string; value: string; authority?: string }>
	): { scheme: string; value: string } | null {
		if (!identities || identities.length === 0) {
			return null;
		}

		// Try each scheme in priority order
		for (const scheme of ResourceUsageAggregationService.USER_IDENTITY_SCHEMES) {
			const identity = identities.find((id) => id.scheme === scheme);
			if (identity) {
				return { scheme: identity.scheme, value: identity.value };
			}
		}

		// If no known scheme, return the first identity as fallback
		return { scheme: identities[0].scheme, value: identities[0].value };
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
	 * Aggregate OpenStack events with per-instance cumulative tracking.
	 *
	 * OpenStack events come per-server (one event per VM instance).
	 * This method:
	 * 1. Groups events by project_slug + date
	 * 2. For each project+date, loads the previous summary's instance dictionary
	 * 3. Updates the instance dictionary with current events (preserving deleted instances)
	 * 4. Calculates totals by summing all instances
	 * 5. Upserts the summary with the new instance dictionary and totals
	 */
	private async aggregateOpenstackEvents(startDate?: Date, endDate?: Date): Promise<void> {
		this.logger.log('Aggregating OpenStack events with per-instance tracking...');

		// Query OpenStack events - they come per-server, not pre-aggregated
		const queryBuilder = this.eventRepository
			.createQueryBuilder('event')
			.where('event.source = :source', { source: 'openstack' })
			.andWhere('event.project_slug IS NOT NULL');

		if (startDate) {
			queryBuilder.andWhere('event.time_window_start >= :startDate', { startDate });
		}

		if (endDate) {
			queryBuilder.andWhere('event.time_window_end <= :endDate', { endDate });
		}

		const events = await queryBuilder.orderBy('event.time_window_start', 'ASC').getMany();

		if (events.length === 0) {
			this.logger.log('No OpenStack events to aggregate');
			return;
		}

		this.logger.log(`Found ${events.length} OpenStack per-server events to aggregate`);

		// Group events by project_slug + date
		const eventsByProjectDate = new Map<
			string,
			{
				projectSlug: string;
				isPersonal: boolean;
				date: Date;
				events: ResourceUsageEvent[];
			}
		>();

		for (const event of events) {
			const dateKey = event.time_window_start.toISOString().split('T')[0]; // YYYY-MM-DD
			const key = `${event.projectSlug}:${dateKey}`;

			if (!eventsByProjectDate.has(key)) {
				const date = new Date(event.time_window_start);
				date.setHours(0, 0, 0, 0);
				eventsByProjectDate.set(key, {
					projectSlug: event.projectSlug!,
					isPersonal: event.isPersonal,
					date,
					events: []
				});
			}
			eventsByProjectDate.get(key)!.events.push(event);
		}

		this.logger.log(`Processing ${eventsByProjectDate.size} project-date combinations`);

		// Process each project-date combination
		for (const [, group] of eventsByProjectDate) {
			await this.aggregateOpenstackProjectDay(group.projectSlug, group.isPersonal, group.date, group.events);
		}

		this.logger.log('OpenStack per-instance aggregation completed');
	}

	/**
	 * Aggregate OpenStack events for a single project on a single day.
	 * Builds/updates the per-instance dictionary and calculates totals.
	 */
	private async aggregateOpenstackProjectDay(
		projectSlug: string,
		isPersonal: boolean,
		date: Date,
		events: ResourceUsageEvent[]
	): Promise<void> {
		const timeWindowStart = new Date(date);
		timeWindowStart.setHours(0, 0, 0, 0);
		const timeWindowEnd = new Date(date);
		timeWindowEnd.setHours(23, 59, 59, 999);

		// Find previous summary to get existing instance dictionary
		const previousSummary = await this.findPreviousSummary('openstack', timeWindowStart, projectSlug, isPersonal);

		// Start with previous instance dictionary or empty
		const instanceDict: Record<string, OpenstackInstanceMetrics> = previousSummary?.extra?.instances
			? { ...previousSummary.extra.instances }
			: {};

		// Get identities from the first event (all events for same project should have same identities)
		const identities = events[0]?.identities || [];

		// Update instance dictionary with current events
		for (const event of events) {
			// Get server UUID from the extra.allocation_identifier field
			const serverUuid = (event.extra as Record<string, unknown>)?.['allocation_identifier'] as string;
			if (!serverUuid) {
				this.logger.warn(`OpenStack event ${event.id} missing allocation_identifier, skipping`);
				continue;
			}

			// Update instance metrics (replace with current values, not cumulative per-instance)
			instanceDict[serverUuid] = {
				cpu_time_seconds: event.metrics.cpu_time_seconds || 0,
				ram_bytes_allocated: event.metrics.ram_bytes_allocated || 0,
				ram_bytes_used: event.metrics.ram_bytes_used || 0,
				storage_bytes_allocated: event.metrics.storage_bytes_allocated || 0,
				vcpus_allocated: event.metrics.vcpus_allocated || 0,
				used_cpu_percent: event.metrics.used_cpu_percent || null,
				last_seen: new Date().toISOString()
			};
		}

		// Calculate totals by summing all instances
		const totals = this.calculateTotalsFromInstances(instanceDict);

		// Build extra object with instance dictionary
		const extra: ResourceUsageSummaryExtra = {
			instances: instanceDict
		};

		// Find or create today's summary
		const existingSummary = await this.summaryRepository.findOne({
			where: {
				source: 'openstack',
				projectSlug,
				isPersonal,
				timeWindowStart
			}
		});

		if (existingSummary) {
			await this.summaryRepository.update(existingSummary.id, {
				timeWindowEnd,
				metrics: totals,
				extra,
				eventCount: events.length,
				identities,
				updatedAt: new Date()
			});
		} else {
			const summary = this.summaryRepository.create({
				timeWindowStart,
				timeWindowEnd,
				source: 'openstack',
				projectSlug,
				isPersonal,
				metrics: totals,
				extra,
				eventCount: events.length,
				identities
			});
			await this.summaryRepository.save(summary);
		}
	}

	/**
	 * Calculate total metrics by summing all instances in the dictionary.
	 */
	private calculateTotalsFromInstances(
		instances: Record<string, OpenstackInstanceMetrics>
	): ResourceUsageSummaryMetrics {
		let totalCpuTime = 0;
		let totalRamAllocated = 0;
		let totalRamUsed = 0;
		let totalStorageAllocated = 0;
		let totalVcpus = 0;
		let cpuPercentSum = 0;
		let cpuPercentCount = 0;

		for (const instance of Object.values(instances)) {
			totalCpuTime += instance.cpu_time_seconds || 0;
			totalRamAllocated += instance.ram_bytes_allocated || 0;
			totalRamUsed += instance.ram_bytes_used || 0;
			totalStorageAllocated += instance.storage_bytes_allocated || 0;
			totalVcpus += instance.vcpus_allocated || 0;
			if (instance.used_cpu_percent != null) {
				cpuPercentSum += instance.used_cpu_percent;
				cpuPercentCount++;
			}
		}

		return {
			cpu_time_seconds: totalCpuTime,
			walltime_seconds: 0, // OpenStack doesn't track walltime
			cpu_percent_avg: cpuPercentCount > 0 ? cpuPercentSum / cpuPercentCount : null,
			ram_bytes_allocated: totalRamAllocated,
			ram_bytes_used: totalRamUsed,
			storage_bytes_allocated: totalStorageAllocated || null,
			vcpus_allocated: totalVcpus || null
		};
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
