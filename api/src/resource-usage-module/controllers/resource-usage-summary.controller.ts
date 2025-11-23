import { Controller, Get, Query } from '@nestjs/common';
import { ResourceUsageSummaryService } from '../services/resource-usage-summary.service';
import { ResourceUsageSummaryResponseDto } from '../dtos/resource-usage-summary.dto';

@Controller('resource-usage')
export class ResourceUsageSummaryController {
	constructor(private readonly summaryService: ResourceUsageSummaryService) {}

	@Get('summary')
	async getSummary(
		@Query('scopeType') scopeType?: 'user' | 'project' | 'allocation',
		@Query('scopeId') scopeId?: string,
		@Query('source') source?: string
	): Promise<ResourceUsageSummaryResponseDto> {
		return this.summaryService.getSummary({ scopeType, scopeId, source });
	}
}
