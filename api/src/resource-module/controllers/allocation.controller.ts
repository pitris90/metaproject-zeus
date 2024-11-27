import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { AllocationRequestDto } from '../dtos/allocation-request.dto';
import { AllocationService } from '../services/allocation.service';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';
import { AllocationMapper } from '../mappers/allocation.mapper';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { PaginationMapper } from '../../config-module/mappers/pagination.mapper';
import { AllocationStatusDto } from '../dtos/input/allocation-status.dto';

@Controller('/allocation')
@ApiTags('Allocation')
export class AllocationController {
	constructor(
		private readonly allocationService: AllocationService,
		private readonly paginationMapper: PaginationMapper,
		private readonly allocationMapper: AllocationMapper
	) {}

	@Post('/request/:projectId')
	@MinRoleCheck(RoleEnum.USER)
	@HttpCode(201)
	@ApiOperation({
		summary: 'Request allocation',
		description: 'Allow user which is part of the project to request allocation.'
	})
	@ApiCreatedResponse({
		description: 'The allocation was successfully requested.'
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async requestAllocation(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@Body() allocation: AllocationRequestDto
	) {
		await this.allocationService.request(projectId, user.id, allocation);
	}

	@Get('/list/:projectId')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get project allocation list',
		description: 'Get project allocations. This method supports pagination.'
	})
	@ApiOkResponse({
		description: 'Allocations of the project.'
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async allocationList(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting | null
	) {
		const [allocations, count] = await this.allocationService.list(projectId, user.id, pagination, sorting);

		const items = allocations.map((allocation) => this.allocationMapper.toAllocationDto(allocation));
		return this.paginationMapper.toPaginatedResult(pagination, count, items);
	}

	@Get('/detail/:id')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get allocation detail',
		description: 'Get allocation detail if user has access to allocation.'
	})
	@ApiOkResponse({
		description: 'Allocation detail.'
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async allocationDetail(@Param('id') id: number, @RequestUser() user: UserDto) {
		const allocation = await this.allocationService.getDetail(user.id, id);
		return this.allocationMapper.toAllocationDetailDto(allocation);
	}

	@MinRoleCheck(RoleEnum.ADMIN)
	@Post('/detail/:id')
	@HttpCode(201)
	@ApiOperation({
		summary: 'Change allocation status',
		description:
			'Change allocation status. If allocation is denied, end date is not needed. Otherwise, end date is required.'
	})
	@ApiCreatedResponse({
		description: 'Allocation changed.'
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async setAllocationStatus(@Param('id') allocationId: number, @Body() allocationStatus: AllocationStatusDto) {
		await this.allocationService.setStatus(allocationId, allocationStatus);
	}
}
