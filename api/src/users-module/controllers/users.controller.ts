import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserInfoListDto } from '../dtos/user-info.dto';
import { PerunUserService } from '../../perun-module/services/perun-user.service';
import { ProjectPermissionService } from '../../project-module/services/project-permission.service';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../dtos/user.dto';
import { ProjectPermissionEnum } from '../../project-module/enums/project-permission.enum';
import { MemberModel } from '../../project-module/models/member.model';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('User')
@Controller('/users')
export class UsersController {
	public constructor(
		private readonly perunUserService: PerunUserService,
		private readonly projectPermissionService: ProjectPermissionService,
		private readonly memberModel: MemberModel
	) {}

	@Get('/')
	@ApiOperation({
		summary: 'Get all users matching query.',
		description: 'Get all users matching query.'
	})
	@ApiQuery({
		name: 'query',
		required: true,
		description: 'Query to search users.'
	})
	@ApiQuery({
		name: 'projectId',
		required: false,
		description: 'If included and user has permissions, check if user is part of the project.'
	})
	@ApiOkResponse({
		description: 'Users matching query.',
		type: [UserInfoListDto]
	})
	@MinRoleCheck(RoleEnum.USER)
	async getUsersByCriteria(
		@RequestUser() user: UserDto,
		@Query('query') query: string,
		@Query('projectId') projectId: number
	): Promise<UserInfoListDto> {
		if (query.length < 3) {
			return {
				users: []
			};
		}

		const users = this.perunUserService.getUsersByCriteria(query);
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, user.id);

		if (
			userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) &&
			userPermissions.has(ProjectPermissionEnum.VIEW_ALL_MEMBERS)
		) {
			const members = await this.memberModel.getMembersByExternalId(
				projectId,
				users.map((user) => user.id)
			);

			return {
				users: users.filter((user) => !members.some((projectUser) => projectUser.user.externalId === user.id))
			};
		}

		return {
			users
		};
	}
}
