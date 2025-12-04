import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResourceUsageAggregationService } from '../services/resource-usage-aggregation.service';
import { ResourceUsageDownsamplingService } from '../services/resource-usage-downsampling.service';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('Resource Usage')
@Controller('resource-usage')
export class ResourceUsageAggregationController {
	constructor(
		private readonly aggregationService: ResourceUsageAggregationService,
		private readonly downsamplingService: ResourceUsageDownsamplingService
	) {}

	@Post('aggregate')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({ summary: 'Manually trigger daily aggregation of raw events into summaries' })
	async aggregateDailySummaries(
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string
	): Promise<{ message: string }> {
		const start = startDate ? new Date(startDate) : undefined;
		const end = endDate ? new Date(endDate) : undefined;

		await this.aggregationService.aggregateDailySummaries(start, end);

		return { message: 'Aggregation completed successfully' };
	}

	@Post('downsample')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Manually trigger data downsampling',
		description: `Performs tiered data retention:
		- Daily summaries older than 1 month → aggregated to weekly
		- Weekly summaries older than 3 months → aggregated to bi-weekly
		- Bi-weekly summaries older than 6 months → aggregated to monthly
		- Raw events older than 1 month → deleted (after aggregation)`
	})
	@ApiResponse({
		status: 200,
		description: 'Downsampling completed',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string' },
				weeklyAggregated: { type: 'number' },
				biweeklyAggregated: { type: 'number' },
				monthlyAggregated: { type: 'number' },
				eventsDeleted: { type: 'number' },
				summariesDeleted: { type: 'number' }
			}
		}
	})
	async performDownsampling(): Promise<{
		message: string;
		weeklyAggregated: number;
		biweeklyAggregated: number;
		monthlyAggregated: number;
		eventsDeleted: number;
		summariesDeleted: number;
	}> {
		const result = await this.downsamplingService.performDownsampling();

		return {
			message: 'Downsampling completed successfully',
			...result
		};
	}

	@Get('retention-stats')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Get retention statistics',
		description: 'Returns statistics about current data distribution across retention tiers'
	})
	@ApiResponse({
		status: 200,
		description: 'Retention statistics',
		schema: {
			type: 'object',
			properties: {
				rawEvents: {
					type: 'object',
					properties: {
						total: { type: 'number' },
						olderThan1Month: { type: 'number' }
					}
				},
				summaries: {
					type: 'object',
					properties: {
						daily: { type: 'number' },
						weekly: { type: 'number' },
						biweekly: { type: 'number' },
						monthly: { type: 'number' }
					}
				}
			}
		}
	})
	async getRetentionStats(): Promise<{
		rawEvents: { total: number; olderThan1Month: number };
		summaries: {
			daily: number;
			weekly: number;
			biweekly: number;
			monthly: number;
		};
	}> {
		return this.downsamplingService.getRetentionStats();
	}
}
