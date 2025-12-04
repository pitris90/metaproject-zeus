import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ResourceUsageEvent, ResourceUsageSummary } from 'resource-manager-database';

/**
 * Retention tier configuration (for documentation)
 * - DAILY: Raw events and daily summaries (< 1 month old)
 * - WEEKLY: Weekly aggregates (1-3 months old)
 * - BIWEEKLY: Bi-weekly aggregates (3-6 months old)
 * - MONTHLY: Monthly aggregates (> 6 months old)
 */

/**
 * Retention thresholds in days
 */
const RETENTION_THRESHOLDS = {
	DAILY_TO_WEEKLY: 30, // 1 month
	WEEKLY_TO_BIWEEKLY: 90, // 3 months
	BIWEEKLY_TO_MONTHLY: 180 // 6 months
};

/**
 * Service responsible for automatic data retention and downsampling.
 *
 * This service implements tiered data retention to reduce storage while preserving
 * historical trends. It aggregates old data into coarser time windows and deletes
 * the source data after successful aggregation.
 *
 * Retention tiers:
 * - Daily (< 1 month): Keep all daily summaries and raw events
 * - Weekly (1-3 months): Aggregate daily → weekly, delete daily summaries & raw events
 * - Bi-weekly (3-6 months): Aggregate weekly → bi-weekly, delete weekly summaries
 * - Monthly (> 6 months): Aggregate bi-weekly → monthly, delete bi-weekly summaries
 *
 * Key design decisions:
 * - Uses ISO weeks (Monday-Sunday) for weekly aggregation
 * - Waits for complete periods before aggregating (e.g., aggregate last week on Monday)
 * - Uses MAX for cumulative metrics (cpu_time, walltime, vcpus, ram, storage)
 * - Uses AVG for percentage metrics
 * - Uses SUM for event_count to track total number of source records
 */
@Injectable()
export class ResourceUsageDownsamplingService {
	private readonly logger = new Logger(ResourceUsageDownsamplingService.name);

	constructor(
		@InjectRepository(ResourceUsageEvent)
		private readonly eventRepository: Repository<ResourceUsageEvent>,
		@InjectRepository(ResourceUsageSummary)
		private readonly summaryRepository: Repository<ResourceUsageSummary>
	) {}

	/**
	 * Scheduled job that runs weekly on Monday at 2:00 AM to perform downsampling.
	 * Executes all retention tier transitions that are due.
	 * Runs on Monday to ensure the previous ISO week (Mon-Sun) is fully complete before aggregating.
	 */
	@Cron('0 2 * * 1') // Every Monday at 2:00 AM
	async runScheduledDownsampling(): Promise<void> {
		this.logger.log('Starting scheduled weekly downsampling job...');

		try {
			await this.performDownsampling();
			this.logger.log('Scheduled weekly downsampling job completed successfully');
		} catch (error) {
			this.logger.error('Scheduled weekly downsampling job failed', error);
		}
	}

	/**
	 * Main entry point for downsampling. Can be called manually or by the scheduler.
	 * Performs all retention tier transitions in order from oldest to newest.
	 */
	async performDownsampling(): Promise<{
		weeklyAggregated: number;
		biweeklyAggregated: number;
		monthlyAggregated: number;
		eventsDeleted: number;
		summariesDeleted: number;
	}> {
		const now = new Date();
		this.logger.log(`Starting downsampling at ${now.toISOString()}`);

		// Calculate cutoff dates for each tier
		const weeklyThreshold = this.subtractDays(now, RETENTION_THRESHOLDS.DAILY_TO_WEEKLY);
		const biweeklyThreshold = this.subtractDays(now, RETENTION_THRESHOLDS.WEEKLY_TO_BIWEEKLY);
		const monthlyThreshold = this.subtractDays(now, RETENTION_THRESHOLDS.BIWEEKLY_TO_MONTHLY);

		this.logger.log(`Retention thresholds:`);
		this.logger.log(`  Weekly (>1mo): ${weeklyThreshold.toISOString()}`);
		this.logger.log(`  Bi-weekly (>3mo): ${biweeklyThreshold.toISOString()}`);
		this.logger.log(`  Monthly (>6mo): ${monthlyThreshold.toISOString()}`);

		const result = {
			weeklyAggregated: 0,
			biweeklyAggregated: 0,
			monthlyAggregated: 0,
			eventsDeleted: 0,
			summariesDeleted: 0
		};

		// Step 1: Aggregate bi-weekly → monthly (oldest first)
		const monthlyResult = await this.aggregateToMonthly(monthlyThreshold);
		result.monthlyAggregated = monthlyResult.aggregated;
		result.summariesDeleted += monthlyResult.deleted;

		// Step 2: Aggregate weekly → bi-weekly
		const biweeklyResult = await this.aggregateToBiweekly(biweeklyThreshold, monthlyThreshold);
		result.biweeklyAggregated = biweeklyResult.aggregated;
		result.summariesDeleted += biweeklyResult.deleted;

		// Step 3: Aggregate daily → weekly
		const weeklyResult = await this.aggregateToWeekly(weeklyThreshold, biweeklyThreshold);
		result.weeklyAggregated = weeklyResult.aggregated;
		result.summariesDeleted += weeklyResult.deleted;

		// Step 4: Delete old raw events (older than weekly threshold)
		result.eventsDeleted = await this.deleteOldEvents(weeklyThreshold);

		this.logger.log(`Downsampling completed:`);
		this.logger.log(`  Weekly aggregations: ${result.weeklyAggregated}`);
		this.logger.log(`  Bi-weekly aggregations: ${result.biweeklyAggregated}`);
		this.logger.log(`  Monthly aggregations: ${result.monthlyAggregated}`);
		this.logger.log(`  Events deleted: ${result.eventsDeleted}`);
		this.logger.log(`  Summaries deleted: ${result.summariesDeleted}`);

		return result;
	}

	/**
	 * Aggregate daily summaries into weekly summaries.
	 * Only aggregates complete weeks (waits until Monday to aggregate previous week).
	 *
	 * @param olderThan - Only aggregate summaries older than this date
	 * @param newerThan - Only aggregate summaries newer than this date (to avoid overlapping with bi-weekly)
	 */
	private async aggregateToWeekly(
		olderThan: Date,
		newerThan: Date
	): Promise<{ aggregated: number; deleted: number }> {
		this.logger.log(
			`Aggregating daily → weekly for data between ${newerThan.toISOString()} and ${olderThan.toISOString()}`
		);

		// Find daily summaries (time_window_end - time_window_start ≈ 1 day)
		// that are older than the weekly threshold
		const dailySummaries = await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.time_window_start < :olderThan', { olderThan })
			.andWhere('summary.time_window_start >= :newerThan', { newerThan })
			.andWhere(
				`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) < :maxDuration`,
				{ maxDuration: 86400 * 2 } // Less than 2 days = daily summary
			)
			.orderBy('summary.time_window_start', 'ASC')
			.getMany();

		if (dailySummaries.length === 0) {
			this.logger.log('No daily summaries found for weekly aggregation');
			return { aggregated: 0, deleted: 0 };
		}

		this.logger.log(`Found ${dailySummaries.length} daily summaries to aggregate into weekly`);

		// Group by project_id + source + ISO week
		const weeklyGroups = this.groupByWeek(dailySummaries);

		let aggregatedCount = 0;
		const summariesToDelete: string[] = [];

		for (const summaries of weeklyGroups.values()) {
			// Only aggregate if the week is complete (all 7 days have passed)
			const { weekStart, weekEnd } = this.getWeekBoundaries(summaries[0].timeWindowStart);

			if (weekEnd > olderThan) {
				// Week not complete yet, skip
				continue;
			}

			// Create weekly aggregate
			const aggregate = this.aggregateSummaries(summaries, weekStart, weekEnd);

			// Check if weekly summary already exists
			const existing = await this.summaryRepository.findOne({
				where: {
					projectId: aggregate.projectId ?? IsNull(),
					source: aggregate.source!,
					timeWindowStart: weekStart
				}
			});

			if (existing) {
				// Update existing
				await this.summaryRepository.update(existing.id, {
					...aggregate,
					updatedAt: new Date()
				});
			} else {
				// Create new
				await this.summaryRepository.save(this.summaryRepository.create(aggregate));
			}

			aggregatedCount++;

			// Mark source summaries for deletion
			summariesToDelete.push(...summaries.map((s) => s.id));
		}

		// Delete source daily summaries
		let deletedCount = 0;
		if (summariesToDelete.length > 0) {
			const result = await this.summaryRepository.delete({ id: In(summariesToDelete) });
			deletedCount = result.affected || 0;
		}

		this.logger.log(`Weekly aggregation: created ${aggregatedCount}, deleted ${deletedCount} daily summaries`);
		return { aggregated: aggregatedCount, deleted: deletedCount };
	}

	/**
	 * Aggregate weekly summaries into bi-weekly summaries.
	 *
	 * @param olderThan - Only aggregate summaries older than this date
	 * @param newerThan - Only aggregate summaries newer than this date (to avoid overlapping with monthly)
	 */
	private async aggregateToBiweekly(
		olderThan: Date,
		newerThan: Date
	): Promise<{ aggregated: number; deleted: number }> {
		this.logger.log(
			`Aggregating weekly → bi-weekly for data between ${newerThan.toISOString()} and ${olderThan.toISOString()}`
		);

		// Find weekly summaries (time_window_end - time_window_start ≈ 7 days)
		const weeklySummaries = await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.time_window_start < :olderThan', { olderThan })
			.andWhere('summary.time_window_start >= :newerThan', { newerThan })
			.andWhere(
				`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) >= :minDuration`,
				{ minDuration: 86400 * 5 } // At least 5 days
			)
			.andWhere(
				`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) < :maxDuration`,
				{ maxDuration: 86400 * 10 } // Less than 10 days = weekly summary
			)
			.orderBy('summary.time_window_start', 'ASC')
			.getMany();

		if (weeklySummaries.length === 0) {
			this.logger.log('No weekly summaries found for bi-weekly aggregation');
			return { aggregated: 0, deleted: 0 };
		}

		this.logger.log(`Found ${weeklySummaries.length} weekly summaries to aggregate into bi-weekly`);

		// Group by project_id + source + bi-week (two ISO weeks)
		const biweeklyGroups = this.groupByBiweek(weeklySummaries);

		let aggregatedCount = 0;
		const summariesToDelete: string[] = [];

		for (const summaries of biweeklyGroups.values()) {
			// Only aggregate if both weeks are complete
			const { biweekStart, biweekEnd } = this.getBiweekBoundaries(summaries[0].timeWindowStart);

			if (biweekEnd > olderThan) {
				// Bi-week not complete yet, skip
				continue;
			}

			// Create bi-weekly aggregate
			const aggregate = this.aggregateSummaries(summaries, biweekStart, biweekEnd);

			// Check if bi-weekly summary already exists
			const existing = await this.summaryRepository.findOne({
				where: {
					projectId: aggregate.projectId ?? IsNull(),
					source: aggregate.source!,
					timeWindowStart: biweekStart
				}
			});

			if (existing) {
				await this.summaryRepository.update(existing.id, {
					...aggregate,
					updatedAt: new Date()
				});
			} else {
				await this.summaryRepository.save(this.summaryRepository.create(aggregate));
			}

			aggregatedCount++;
			summariesToDelete.push(...summaries.map((s) => s.id));
		}

		// Delete source weekly summaries
		let deletedCount = 0;
		if (summariesToDelete.length > 0) {
			const result = await this.summaryRepository.delete({ id: In(summariesToDelete) });
			deletedCount = result.affected || 0;
		}

		this.logger.log(`Bi-weekly aggregation: created ${aggregatedCount}, deleted ${deletedCount} weekly summaries`);
		return { aggregated: aggregatedCount, deleted: deletedCount };
	}

	/**
	 * Aggregate bi-weekly summaries into monthly summaries.
	 *
	 * @param olderThan - Only aggregate summaries older than this date
	 */
	private async aggregateToMonthly(olderThan: Date): Promise<{ aggregated: number; deleted: number }> {
		this.logger.log(`Aggregating bi-weekly → monthly for data older than ${olderThan.toISOString()}`);

		// Find bi-weekly summaries (time_window_end - time_window_start ≈ 14 days)
		const biweeklySummaries = await this.summaryRepository
			.createQueryBuilder('summary')
			.where('summary.time_window_start < :olderThan', { olderThan })
			.andWhere(
				`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) >= :minDuration`,
				{ minDuration: 86400 * 10 } // At least 10 days
			)
			.andWhere(
				`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) < :maxDuration`,
				{ maxDuration: 86400 * 20 } // Less than 20 days = bi-weekly summary
			)
			.orderBy('summary.time_window_start', 'ASC')
			.getMany();

		if (biweeklySummaries.length === 0) {
			this.logger.log('No bi-weekly summaries found for monthly aggregation');
			return { aggregated: 0, deleted: 0 };
		}

		this.logger.log(`Found ${biweeklySummaries.length} bi-weekly summaries to aggregate into monthly`);

		// Group by project_id + source + month
		const monthlyGroups = this.groupByMonth(biweeklySummaries);

		let aggregatedCount = 0;
		const summariesToDelete: string[] = [];

		for (const summaries of monthlyGroups.values()) {
			const { monthStart, monthEnd } = this.getMonthBoundaries(summaries[0].timeWindowStart);

			if (monthEnd > olderThan) {
				// Month not complete yet, skip
				continue;
			}

			// Create monthly aggregate
			const aggregate = this.aggregateSummaries(summaries, monthStart, monthEnd);

			// Check if monthly summary already exists
			const existing = await this.summaryRepository.findOne({
				where: {
					projectId: aggregate.projectId ?? IsNull(),
					source: aggregate.source!,
					timeWindowStart: monthStart
				}
			});

			if (existing) {
				await this.summaryRepository.update(existing.id, {
					...aggregate,
					updatedAt: new Date()
				});
			} else {
				await this.summaryRepository.save(this.summaryRepository.create(aggregate));
			}

			aggregatedCount++;
			summariesToDelete.push(...summaries.map((s) => s.id));
		}

		// Delete source bi-weekly summaries
		let deletedCount = 0;
		if (summariesToDelete.length > 0) {
			const result = await this.summaryRepository.delete({ id: In(summariesToDelete) });
			deletedCount = result.affected || 0;
		}

		this.logger.log(`Monthly aggregation: created ${aggregatedCount}, deleted ${deletedCount} bi-weekly summaries`);
		return { aggregated: aggregatedCount, deleted: deletedCount };
	}

	/**
	 * Delete raw events that are older than the retention threshold.
	 * Events are deleted after they've been aggregated into summaries.
	 *
	 * @param olderThan - Delete events older than this date
	 */
	private async deleteOldEvents(olderThan: Date): Promise<number> {
		this.logger.log(`Deleting raw events older than ${olderThan.toISOString()}`);

		// Only delete events that have been mapped to a project (i.e., aggregated)
		const result = await this.eventRepository
			.createQueryBuilder()
			.delete()
			.from(ResourceUsageEvent)
			.where('time_window_start < :olderThan', { olderThan })
			.andWhere('project_id IS NOT NULL')
			.execute();

		const deletedCount = result.affected || 0;
		this.logger.log(`Deleted ${deletedCount} old raw events`);
		return deletedCount;
	}

	// =========================================================================
	// Grouping Helpers
	// =========================================================================

	/**
	 * Group summaries by project_id + source + ISO week number
	 */
	private groupByWeek(summaries: ResourceUsageSummary[]): Map<string, ResourceUsageSummary[]> {
		const groups = new Map<string, ResourceUsageSummary[]>();

		for (const summary of summaries) {
			const { year, week } = this.getISOWeek(summary.timeWindowStart);
			const key = `${summary.projectId}:${summary.source}:${year}-W${week}`;

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(summary);
		}

		return groups;
	}

	/**
	 * Group summaries by project_id + source + bi-week (even/odd weeks paired)
	 */
	private groupByBiweek(summaries: ResourceUsageSummary[]): Map<string, ResourceUsageSummary[]> {
		const groups = new Map<string, ResourceUsageSummary[]>();

		for (const summary of summaries) {
			const { year, week } = this.getISOWeek(summary.timeWindowStart);
			// Pair weeks: 1-2, 3-4, 5-6, etc.
			const biweek = Math.ceil(week / 2);
			const key = `${summary.projectId}:${summary.source}:${year}-BW${biweek}`;

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(summary);
		}

		return groups;
	}

	/**
	 * Group summaries by project_id + source + year-month
	 */
	private groupByMonth(summaries: ResourceUsageSummary[]): Map<string, ResourceUsageSummary[]> {
		const groups = new Map<string, ResourceUsageSummary[]>();

		for (const summary of summaries) {
			const year = summary.timeWindowStart.getFullYear();
			const month = summary.timeWindowStart.getMonth() + 1;
			const key = `${summary.projectId}:${summary.source}:${year}-${month.toString().padStart(2, '0')}`;

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(summary);
		}

		return groups;
	}

	// =========================================================================
	// Aggregation Helpers
	// =========================================================================

	/**
	 * Aggregate multiple summaries into a single summary.
	 * Uses MAX for cumulative metrics, AVG for percentages, SUM for event_count.
	 */
	private aggregateSummaries(
		summaries: ResourceUsageSummary[],
		timeWindowStart: Date,
		timeWindowEnd: Date
	): Partial<ResourceUsageSummary> {
		if (summaries.length === 0) {
			throw new Error('Cannot aggregate empty summary list');
		}

		const first = summaries[0];

		// MAX for cumulative metrics
		const cpuTimeSeconds = Math.max(...summaries.map((s) => Number(s.cpuTimeSeconds) || 0));
		const walltimeSeconds = Math.max(...summaries.map((s) => Number(s.walltimeSeconds) || 0));
		const ramBytesAllocated = Math.max(...summaries.map((s) => Number(s.ramBytesAllocated) || 0));
		const ramBytesUsed = Math.max(...summaries.map((s) => Number(s.ramBytesUsed) || 0));
		const storageBytesAllocated = Math.max(...summaries.map((s) => Number(s.storageBytesAllocated) || 0));
		const vcpusAllocated = Math.max(...summaries.map((s) => Number(s.vcpusAllocated) || 0));

		// AVG for percentages
		const cpuPercentValues = summaries.map((s) => s.cpuPercentAvg).filter((v) => v !== null) as number[];
		const cpuPercentAvg =
			cpuPercentValues.length > 0 ? cpuPercentValues.reduce((a, b) => a + b, 0) / cpuPercentValues.length : null;

		// SUM for event count
		const eventCount = summaries.reduce((sum, s) => sum + (Number(s.eventCount) || 0), 0);

		// Merge identities (deduplicate by scheme:value)
		const identitiesMap = new Map<string, { scheme: string; value: string; authority?: string }>();
		for (const summary of summaries) {
			for (const identity of summary.identities || []) {
				const key = `${identity.scheme}:${identity.value}`;
				if (!identitiesMap.has(key)) {
					identitiesMap.set(key, identity);
				}
			}
		}
		const identities = Array.from(identitiesMap.values());

		return {
			timeWindowStart,
			timeWindowEnd,
			source: first.source,
			projectSlug: first.projectSlug,
			isPersonal: first.isPersonal,
			projectId: first.projectId,
			cpuTimeSeconds,
			walltimeSeconds,
			cpuPercentAvg,
			ramBytesAllocated,
			ramBytesUsed,
			storageBytesAllocated: storageBytesAllocated || null,
			vcpusAllocated: vcpusAllocated || null,
			eventCount,
			identities
		};
	}

	// =========================================================================
	// Date Helpers
	// =========================================================================

	/**
	 * Get ISO week number and year for a date.
	 * ISO weeks start on Monday and week 1 contains the first Thursday of the year.
	 */
	private getISOWeek(date: Date): { year: number; week: number } {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
		d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
		return { year: d.getUTCFullYear(), week };
	}

	/**
	 * Get the start (Monday 00:00) and end (Sunday 23:59:59) of the ISO week containing the given date.
	 */
	private getWeekBoundaries(date: Date): { weekStart: Date; weekEnd: Date } {
		const d = new Date(date);
		const dayOfWeek = d.getDay();
		const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = -6, other days = 1 - dayOfWeek

		const weekStart = new Date(d);
		weekStart.setDate(d.getDate() + diffToMonday);
		weekStart.setHours(0, 0, 0, 0);

		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		weekEnd.setHours(23, 59, 59, 999);

		return { weekStart, weekEnd };
	}

	/**
	 * Get the start and end of a bi-week (two consecutive ISO weeks).
	 * Bi-weeks are paired: weeks 1-2, 3-4, 5-6, etc.
	 */
	private getBiweekBoundaries(date: Date): { biweekStart: Date; biweekEnd: Date } {
		const { week } = this.getISOWeek(date);
		const { weekStart } = this.getWeekBoundaries(date);

		// If odd week, this is the start of the bi-week
		// If even week, go back one week to get the start
		const biweekStart = new Date(weekStart);
		if (week % 2 === 0) {
			biweekStart.setDate(biweekStart.getDate() - 7);
		}

		const biweekEnd = new Date(biweekStart);
		biweekEnd.setDate(biweekStart.getDate() + 13); // 14 days - 1
		biweekEnd.setHours(23, 59, 59, 999);

		return { biweekStart, biweekEnd };
	}

	/**
	 * Get the start (1st day 00:00) and end (last day 23:59:59) of the month containing the given date.
	 */
	private getMonthBoundaries(date: Date): { monthStart: Date; monthEnd: Date } {
		const monthStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
		const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
		return { monthStart, monthEnd };
	}

	/**
	 * Subtract days from a date, returning a new Date object.
	 */
	private subtractDays(date: Date, days: number): Date {
		const result = new Date(date);
		result.setDate(result.getDate() - days);
		return result;
	}

	// =========================================================================
	// Manual Trigger Methods (for admin use)
	// =========================================================================

	/**
	 * Get statistics about current data distribution across retention tiers.
	 */
	async getRetentionStats(): Promise<{
		rawEvents: { total: number; olderThan1Month: number };
		summaries: {
			daily: number;
			weekly: number;
			biweekly: number;
			monthly: number;
		};
	}> {
		const now = new Date();
		const weeklyThreshold = this.subtractDays(now, RETENTION_THRESHOLDS.DAILY_TO_WEEKLY);

		// Count raw events
		const totalEvents = await this.eventRepository.count();
		const oldEvents = await this.eventRepository.count({
			where: { time_window_start: LessThan(weeklyThreshold) }
		});

		// Count summaries by duration
		const dailyCount = await this.summaryRepository
			.createQueryBuilder('summary')
			.where(`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) < :maxDuration`, {
				maxDuration: 86400 * 2
			})
			.getCount();

		const weeklyCount = await this.summaryRepository
			.createQueryBuilder('summary')
			.where(`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) >= :minDuration`, {
				minDuration: 86400 * 5
			})
			.andWhere(`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) < :maxDuration`, {
				maxDuration: 86400 * 10
			})
			.getCount();

		const biweeklyCount = await this.summaryRepository
			.createQueryBuilder('summary')
			.where(`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) >= :minDuration`, {
				minDuration: 86400 * 10
			})
			.andWhere(`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) < :maxDuration`, {
				maxDuration: 86400 * 20
			})
			.getCount();

		const monthlyCount = await this.summaryRepository
			.createQueryBuilder('summary')
			.where(`EXTRACT(EPOCH FROM (summary.time_window_end - summary.time_window_start)) >= :minDuration`, {
				minDuration: 86400 * 20
			})
			.getCount();

		return {
			rawEvents: {
				total: totalEvents,
				olderThan1Month: oldEvents
			},
			summaries: {
				daily: dailyCount,
				weekly: weeklyCount,
				biweekly: biweeklyCount,
				monthly: monthlyCount
			}
		};
	}
}
