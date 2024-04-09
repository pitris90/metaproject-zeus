import { Controller, Get, Param } from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberService } from '../services/member.service';
import { MemberDto } from '../dtos/member.dto';

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
		type: [MemberDto]
	})
	@ApiConflictResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async getProjectMembers(@Param('id') id: number, @RequestUser() user: UserDto) {
		return this.memberService.getProjectMembers(id, user);
	}
}
