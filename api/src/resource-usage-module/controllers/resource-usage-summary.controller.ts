import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceUsageSummaryService } from '../services/resource-usage-summary.service';
import { ResourceUsageSummaryResponseDto } from '../dtos/resource-usage-summary.dto';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('Resource Usage')
@Controller('resource-usage')
export class ResourceUsageSummaryController {
	constructor(private readonly summaryService: ResourceUsageSummaryService) {}

	@Get('summary')
	@MinRoleCheck(RoleEnum.USER)
	async getSummary(
		@Query('scopeType') scopeType?: 'user' | 'project' | 'allocation',
		@Query('scopeId') scopeId?: string,
		@Query('source') source?: string,
		@Query('allocationId') allocationId?: string
	): Promise<ResourceUsageSummaryResponseDto> {
		return this.summaryService.getSummary({ scopeType, scopeId, source, allocationId });
	}
}
