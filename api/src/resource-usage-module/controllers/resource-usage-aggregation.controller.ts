import { Controller, Post, Query } from '@nestjs/common';
import { ResourceUsageAggregationService } from '../services/resource-usage-aggregation.service';

@Controller('resource-usage')
export class ResourceUsageAggregationController {
	constructor(private readonly aggregationService: ResourceUsageAggregationService) {}

	@Post('aggregate')
	async aggregateDailySummaries(
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string
	): Promise<{ message: string }> {
		const start = startDate ? new Date(startDate) : undefined;
		const end = endDate ? new Date(endDate) : undefined;

		await this.aggregationService.aggregateDailySummaries(start, end);

		return { message: 'Aggregation completed successfully' };
	}
}
