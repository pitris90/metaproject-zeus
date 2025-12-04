import { Controller, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceUsageAggregationService } from '../services/resource-usage-aggregation.service';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('Resource Usage')
@Controller('resource-usage')
export class ResourceUsageAggregationController {
	constructor(private readonly aggregationService: ResourceUsageAggregationService) {}

	@Post('aggregate')
	@MinRoleCheck(RoleEnum.ADMIN)
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
