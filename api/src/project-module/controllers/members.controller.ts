import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberService } from '../services/member.service';
import { MemberListDto } from '../dtos/member-list.dto';
import { MemberRequestListDto } from '../dtos/input/member-request.dto';
import { ProjectInvalidStatusApiException } from '../../error-module/errors/projects/project-invalid-status.api-exception';

@ApiTags('Project')
@Controller('/project')
export class MembersController {
	public constructor(private readonly memberService: MemberService) {}

	@Get(':id/members')
	@PermissionsCheck([PermissionEnum.GET_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Get members of specific project',
		description: 'Get members of specific project.'
	})
	@ApiOkResponse({
		description: 'Members of the project.',
		type: [MemberListDto]
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async getProjectMembers(@Param('id') id: number, @RequestUser() user: UserDto): Promise<MemberListDto> {
		const members = await this.memberService.getProjectMembers(id, user);
		return {
			members
		};
	}

	@Post(':id/members')
	@PermissionsCheck([PermissionEnum.GET_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Add members to specific project',
		description: 'Add members to specific project. This endpoint either adds all members or none of the members.'
	})
	@ApiCreatedResponse({
		description: 'Members added to the project.'
	})
	@ApiForbiddenResponse({
		description: 'Project status is not valid for adding members.',
		type: ProjectInvalidStatusApiException
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async addProjectMembers(
		@Param('id') id: number,
		@RequestUser() user: UserDto,
		@Body() membersBody: MemberRequestListDto
	) {
		const membersToAdd = membersBody.members;
		await this.memberService.addProjectMembers(id, user.id, membersToAdd);
	}
}
