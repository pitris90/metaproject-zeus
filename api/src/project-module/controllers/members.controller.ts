import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
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
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberService } from '../services/member.service';
import { MemberRequestListDto } from '../dtos/input/member-request.dto';
import { ProjectInvalidStatusApiException } from '../../error-module/errors/projects/project-invalid-status.api-exception';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { MemberMapper } from '../mappers/member.mapper';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { PerunFacade } from '../../perun-module/perun.facade';
import { PaginationMapper } from '../../config-module/mappers/pagination.mapper';
import { MemberDto } from '../dtos/member.dto';
import { PaginatedResultDto } from '../../config-module/dtos/paginated-result.dto';
import { MemberListDto } from '../dtos/member-list.dto';
import { IsStepUp } from '../../auth-module/decorators/is-step-up.decorator';

@ApiTags('Project')
@Controller('/project')
export class MembersController {
	public constructor(
		private readonly memberService: MemberService,
		private readonly paginationMapper: PaginationMapper,
		private readonly memberMapper: MemberMapper,
		private readonly perunFacade: PerunFacade
	) {}

	@Get(':id/members')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get members of specific project',
		description: 'Get members of specific project.'
	})
	@ApiOkResponse({
		description: 'Members of the project.',
		type: MemberListDto
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async getProjectMembers(
		@Param('id') id: number,
		@RequestUser() user: UserDto,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting | null,
		@IsStepUp() isStepUp: boolean
	): Promise<PaginatedResultDto<MemberDto>> {
		const [members, count] = await this.memberService.getProjectMembers(id, user, pagination, sorting, isStepUp);
		const items = members.map((member) => this.memberMapper.toMemberDto(member));
		return this.paginationMapper.toPaginatedResult<MemberDto>(pagination, count, items);
	}

	@Post(':id/members')
	@MinRoleCheck(RoleEnum.USER)
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
		@Body() membersBody: MemberRequestListDto,
		@Headers('Authorization') authorizationHeader: string,
		@IsStepUp() isStepUp: boolean
	) {
		const accessToken = authorizationHeader.split(' ')[1]?.trim();

		if (!accessToken) {
			throw new UnauthorizedException();
		}

		const membersToAdd = membersBody.members;
		const addedEmails = await this.memberService.addProjectMembers(id, user.id, membersToAdd, isStepUp);

		if (addedEmails.length > 0) {
			await this.perunFacade.inviteMembers(accessToken, addedEmails, id);
		}
	}

	@Delete(':projectId/members/:userId')
	@MinRoleCheck(RoleEnum.USER)
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
		@RequestUser() user: UserDto,
		@IsStepUp() isStepUp: boolean
	) {
		await this.memberService.deleteProjectMember(projectId, user.id, memberId, isStepUp);
	}
}
