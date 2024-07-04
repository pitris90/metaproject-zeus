import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { ProjectService } from '../services/project.service';
import { ProjectDto } from '../dtos/project.dto';
import { MyProjectsDto } from '../dtos/my-projects.dto';
import { ProjectRequestExistsApiException } from '../../error-module/errors/projects/project-request-exists.api-exception';
import { ProjectMapper } from '../mappers/project.mapper';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectDetailDto } from '../dtos/project-detail.dto';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';

/**
 * Project controller that contains basic methods for manipulating projects. Mainly methods like getting user projects and requesting a project.
 */
@ApiTags('Project')
@Controller('/project')
export class ProjectController {
	constructor(
		private readonly projectService: ProjectService,
		private readonly projectMapper: ProjectMapper
	) {}

	@Get()
	@PermissionsCheck([PermissionEnum.GET_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Get my projects',
		description: 'Get all projects that the user has requested or is a part of.'
	})
	@ApiOkResponse({
		description: 'The projects were successfully retrieved.',
		type: [MyProjectsDto]
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Filter projects by status.',
		enum: ['new', 'active', 'inactive']
	})
	async getMyProjects(
		@RequestUser() user: User,
		@Query('status') status: 'new' | 'active' | 'archived' | null,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting
	): Promise<MyProjectsDto> {
		const projectStatus = this.projectMapper.toProjectStatus(status);
		const [projects, count] = await this.projectService.getUserProjects(
			user.id,
			projectStatus,
			pagination,
			sorting
		);
		return {
			metadata: {
				page: pagination.page,
				recordsPerPage: pagination.limit,
				totalRecords: count
			},
			projects
		};
	}

	@Get(':id')
	@PermissionsCheck([PermissionEnum.GET_OWNED_PROJECTS])
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
	@PermissionsCheck([PermissionEnum.REQUEST_PROJECT])
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
		type: ProjectRequestExistsApiException
	})
	@ApiBody({
		type: RequestProjectDto
	})
	async requestProject(@Body() requestProjectDto: RequestProjectDto, @RequestUser() user: User): Promise<ProjectDto> {
		return this.projectService.requestProject(requestProjectDto, user.id);
	}
}
