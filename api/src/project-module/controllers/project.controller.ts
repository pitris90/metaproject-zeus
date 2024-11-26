import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { User } from 'resource-manager-database';
import {
	ApiBody,
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiTags
} from '@nestjs/swagger';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { ProjectService } from '../services/project.service';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectsDto } from '../dtos/my-projects.dto';
import { ProjectExistsApiException } from '../../error-module/errors/projects/project-exists.api-exception';
import { ProjectMapper } from '../mappers/project.mapper';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectDetailDto } from '../dtos/project-detail.dto';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { PaginationMapper } from '../../config-module/mappers/pagination.mapper';
import { PaginatedResultDto } from '../../config-module/dtos/paginated-result.dto';

/**
 * Project controller that contains basic methods for manipulating projects. Mainly methods like getting user projects and requesting a project.
 */
@ApiTags('Project')
@Controller('/project')
export class ProjectController {
	constructor(
		private readonly projectService: ProjectService,
		private readonly paginationMapper: PaginationMapper,
		private readonly projectMapper: ProjectMapper
	) {}

	@Get()
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get my projects',
		description: 'Get all projects that the user has requested or is a part of.'
	})
	@ApiOkResponse({
		description: 'The projects were successfully retrieved.',
		type: [ProjectsDto]
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Filter projects by status.',
		enum: ['new', 'active', 'archived', 'rejected']
	})
	async getMyProjects(
		@RequestUser() user: User,
		@Query('status') status: 'new' | 'active' | 'archived' | 'rejected' | null,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting
	): Promise<PaginatedResultDto<ProjectDto>> {
		const projectStatus = this.projectMapper.toProjectStatus(status);
		const [projects, count] = await this.projectService.getUserProjects(
			user.id,
			projectStatus,
			pagination,
			sorting
		);
		return this.paginationMapper.toPaginatedResult(pagination, count, projects);
	}

	@Get('all')
	@MinRoleCheck(RoleEnum.DIRECTOR)
	@ApiOperation({
		summary: 'Get all projects',
		description: 'Get all projects. Can filter by status.'
	})
	@ApiOkResponse({
		description: 'The projects were successfully retrieved.',
		type: [ProjectsDto]
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Filter projects by status.',
		enum: ['new', 'active', 'archived', 'rejected']
	})
	async getAllProjects(
		@Query('status') status: 'new' | 'active' | 'archived' | 'rejected' | null,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting
	) {
		const projectStatus = this.projectMapper.toProjectStatus(status);
		const [projects, count] = await this.projectService.getProjects(projectStatus, pagination, sorting);
		return this.paginationMapper.toPaginatedResult(pagination, count, projects);
	}

	@Get(':id')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get project detail of concrete project',
		description: 'Gets detail of project which user is part of.'
	})
	@ApiOkResponse({
		description: 'The project detail was successfully retrieved.',
		type: ProjectDetailDto
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to a project.',
		type: ProjectNotFoundApiException
	})
	async projectDetail(@Param('id') id: number, @RequestUser() user: User): Promise<ProjectDetailDto> {
		return this.projectService.getProjectDetail(id, user.id);
	}

	@Post()
	@HttpCode(201)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Request a project',
		description: 'Request a project to be created.'
	})
	@ApiOkResponse({
		description: 'The project was successfully requested.',
		type: ProjectDto
	})
	@ApiConflictResponse({
		description: 'A project request already exists.',
		type: ProjectExistsApiException
	})
	@ApiBody({
		type: RequestProjectDto
	})
	async requestProject(
		@Body() requestProjectDto: RequestProjectDto,
		@RequestUser() user: UserDto
	): Promise<ProjectDto> {
		return this.projectService.requestProject(requestProjectDto, user.id);
	}

	@Post(':id/request')
	@HttpCode(204)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Re-request a project',
		description:
			'Should be called after updating info in rejected project to send project to review again. Project should be in rejected state.'
	})
	@ApiConflictResponse({
		description: 'Different project with same info already exists.',
		type: ProjectExistsApiException
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user does not have correct access to a project.',
		type: ProjectNotFoundApiException
	})
	@ApiBody({
		type: RequestProjectDto
	})
	async requestProjectAgain(
		@Param('id') projectId: number,
		@RequestUser() user: UserDto,
		@Body() requestProjectDto: RequestProjectDto
	) {
		await this.projectService.requestProjectAgain(projectId, user.id, requestProjectDto);
	}
}
