import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import {
	ApiBody,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger';
import { ProjectApprovalService } from '../services/project-approval.service';
import { ProjectApproveDto } from '../dtos/input/project-approve.dto';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectRejectDto } from '../dtos/input/project-reject.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectHasApprovalApiException } from '../../error-module/errors/projects/project-has-approval.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('Project')
@Controller('/project/approval')
export class ProjectApprovalController {
	constructor(private readonly projectApprovalService: ProjectApprovalService) {}

	@Post('/approve')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Approve a project',
		description: 'Approve a project request.'
	})
	@ApiOkResponse({
		description: 'The project was successfully approved.',
		type: ProjectDto
	})
	@ApiForbiddenResponse({
		description: 'Project is already rejected or approved.',
		type: ProjectHasApprovalApiException
	})
	@ApiNotFoundResponse({
		description: 'Project does not exist.',
		type: ProjectNotFoundApiException
	})
	@ApiBody({
		type: ProjectApproveDto,
		description: 'The project to approve'
	})
	public async approveProject(
		@RequestUser() user: UserDto,
		@Body() projectApprovalDto: ProjectApproveDto
	): Promise<ProjectDto> {
		return this.projectApprovalService.approveProject(user.id, projectApprovalDto.projectId);
	}

	@Post('/reject')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Reject a project',
		description: 'Reject a project request.'
	})
	@ApiOkResponse({
		description: 'The project was successfully rejected.',
		type: ProjectDto
	})
	@ApiForbiddenResponse({
		description: 'User does not have permission to reject projects.',
		type: ForbiddenException
	})
	@ApiForbiddenResponse({
		description: 'Project is already rejected or approved.',
		type: ProjectHasApprovalApiException
	})
	@ApiNotFoundResponse({
		description: 'Project does not exist.',
		type: ProjectNotFoundApiException
	})
	@ApiBody({
		type: ProjectApproveDto,
		description: 'The project to reject'
	})
	public async rejectProject(
		@RequestUser() user: UserDto,
		@Body() projectRejectDto: ProjectRejectDto
	): Promise<ProjectDto> {
		return this.projectApprovalService.rejectProject(user.id, projectRejectDto.projectId, projectRejectDto.reason);
	}
}
