import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNoContentResponse,
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
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { MemberMapper } from '../mappers/member.mapper';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';

@ApiTags('Project')
@Controller('/project')
export class MembersController {
	public constructor(
		private readonly memberService: MemberService,
		private readonly memberMapper: MemberMapper
	) {}

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
	async getProjectMembers(
		@Param('id') id: number,
		@RequestUser() user: UserDto,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting | null
	): Promise<MemberListDto> {
		const [members, count] = await this.memberService.getProjectMembers(id, user, pagination, sorting);
		return {
			metadata: {
				page: pagination.page,
				recordsPerPage: members.length,
				totalRecords: count
			},
			members: members.map((member) => this.memberMapper.toMemberDto(member))
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

	@Delete(':projectId/members/:userId')
	@PermissionsCheck([PermissionEnum.GET_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Deletes member from specific project',
		description: 'Deletes member from specific project.'
	})
	@ApiNoContentResponse({
		description: 'Member deleted from project.'
	})
	@ApiForbiddenResponse({
		description: 'Project status is not valid for adding members.',
		type: ProjectInvalidStatusApiException
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async removeProjectMember(
		@Param('projectId') projectId: number,
		@Param('userId') memberId: number,
		@RequestUser() user: UserDto
	) {
		await this.memberService.deleteProjectMember(projectId, user.id, memberId);
	}
}
