import { Body, Controller, Get, Post } from '@nestjs/common';
import { User } from 'resource-manager-database';
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
	async getMyProjects(@RequestUser() user: User): Promise<ProjectDto[]> {
		return this.projectService.getUserProjects(user.id);
	}

	@Post()
	@PermissionsCheck([PermissionEnum.REQUEST_PROJECT])
	async requestProject(@Body() requestProjectDto: RequestProjectDto, @RequestUser() user: User): Promise<ProjectDto> {
		return this.projectService.requestProject(requestProjectDto, user.id);
	}
}
