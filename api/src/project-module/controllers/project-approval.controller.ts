import { Body, Controller, Post } from '@nestjs/common';
import { User } from 'resource-manager-database';
import { ProjectApprovalService } from '../services/project-approval.service';
import { ProjectApproveDto } from '../dtos/project-approve.dto';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectRejectDto } from '../dtos/project-reject.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';

@Controller('/project/approval')
export class ProjectApprovalController {
	constructor(private readonly projectApprovalService: ProjectApprovalService) {}

	@Post('/approve')
	@PermissionsCheck([PermissionEnum.PROJECT_APPROVAL])
	public async approveProject(
		@RequestUser() user: User,
		@Body() projectApprovalDto: ProjectApproveDto
	): Promise<ProjectDto> {
		return this.projectApprovalService.approveProject(user.id, projectApprovalDto.projectId);
	}

	@Post('/reject')
	@PermissionsCheck([PermissionEnum.PROJECT_APPROVAL])
	public async rejectProject(
		@RequestUser() user: User,
		@Body() projectRejectDto: ProjectRejectDto
	): Promise<ProjectDto> {
		return this.projectApprovalService.rejectProject(user.id, projectRejectDto.projectId, projectRejectDto.reason);
	}
}
