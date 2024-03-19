import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ProjectStatus, User } from 'resource-manager-database';
import { ApiBody, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { RequestProjectDto } from '../dtos/request-project.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { ProjectService } from '../services/project.service';
import { ProjectDto } from '../dtos/project.dto';
import { MyProjectsDto } from '../dtos/my-projects.dto';
import { ProjectRequestExistsApiException } from '../../error-module/errors/projects/project-request-exists.api-exception';

/**
 * Project controller that contains basic methods for manipulating projects. Mainly methods like getting user projects and requesting a project.
 */
@ApiTags('Project')
@Controller('/project')
export class ProjectController {
	constructor(private readonly projectService: ProjectService) {}

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
		@Query('status') status: 'new' | 'active' | 'inactive' | null
	): Promise<MyProjectsDto> {
		return {
			projects: await this.projectService.getUserProjects(user.id, this.getProjectStatus(status))
		};
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

	private getProjectStatus(status: string | null): ProjectStatus | null {
		switch (status) {
			case 'new':
				return ProjectStatus.NEW;
			case 'active':
				return ProjectStatus.ACTIVE;
			default:
				return null;
		}
	}
}
