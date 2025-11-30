import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
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
import { IsStepUp } from '../../auth-module/decorators/is-step-up.decorator';
import { OpenstackModifyRequestDto } from '../../openstack-module/dto/openstack-modify-request.dto';

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
		@Body() allocation: AllocationRequestDto,
		@IsStepUp() isStepUp: boolean
	) {
		await this.allocationService.request(projectId, user.id, allocation, isStepUp);
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
		@GetSorting() sorting: Sorting | null,
		@IsStepUp() isStepUp: boolean
	) {
		const [allocations, count] = await this.allocationService.list(
			projectId,
			user.id,
			pagination,
			sorting,
			isStepUp
		);

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
	async allocationDetail(@Param('id') id: number, @RequestUser() user: UserDto, @IsStepUp() isStepUp: boolean) {
		return this.allocationService.getDetail(user.id, id, isStepUp);
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

	@MinRoleCheck(RoleEnum.DIRECTOR)
	@Get('/all')
	@ApiOperation({
		summary: 'Get all allocations',
		description:
			'Gets all allocations. Filterable by status: "new" for new allocation requests, "pending-modification" for active allocations with pending modifications. This method supports pagination.'
	})
	@ApiOkResponse({
		description: 'Allocations.'
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async getAllAllocations(
		@Query('status') status: 'new' | 'pending-modification' | null,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting
	) {
		const [allocations, count] = await this.allocationService.getAll(status, pagination, sorting);
		return this.paginationMapper.toPaginatedResult(pagination, count, allocations);
	}

	@Post('/detail/:id/openstack/modify')
	@MinRoleCheck(RoleEnum.USER)
	@HttpCode(201)
	@ApiOperation({
		summary: 'Request OpenStack allocation modification',
		description:
			'Submit a modification request for an active OpenStack allocation. Domain cannot be changed. The request will need admin approval.'
	})
	@ApiCreatedResponse({
		description: 'Modification request submitted successfully.'
	})
	@ApiNotFoundResponse({
		description: 'Allocation not found or user has no access.',
		type: ProjectNotFoundApiException
	})
	async modifyOpenstackAllocation(
		@Param('id') allocationId: number,
		@RequestUser() user: UserDto,
		@Body() modifyRequest: OpenstackModifyRequestDto,
		@IsStepUp() isStepUp: boolean
	) {
		await this.allocationService.modifyOpenstackAllocation(allocationId, user.id, modifyRequest, isStepUp);
	}
}
