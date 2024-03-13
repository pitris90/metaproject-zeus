import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ProjectStatus, User } from 'resource-manager-database';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { RequestProjectDto } from '../dtos/request-project.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { ProjectService } from '../services/project.service';
import { ProjectDto } from '../dtos/project.dto';

@Controller('/project')
export class ProjectController {
	constructor(private readonly projectService: ProjectService) {}

	@Get()
	@PermissionsCheck([PermissionEnum.GET_OWNED_PROJECTS])
	async getMyProjects(
		@RequestUser() user: User,
		@Query('status') status: string | null
	): Promise<{ projects: ProjectDto[] }> {
		return {
			projects: await this.projectService.getUserProjects(user.id, this.getProjectStatus(status))
		};
	}

	@Post()
	@PermissionsCheck([PermissionEnum.REQUEST_PROJECT])
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
