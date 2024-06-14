import { Injectable } from '@nestjs/common';
import { ProjectUser } from 'resource-manager-database';
import { MemberDto } from '../dtos/member.dto';
import { UserMapper } from '../../users-module/services/user.mapper';

@Injectable()
export class MemberMapper {
	public constructor(private readonly userMapper: UserMapper) {}

	public toMemberDto(projectMember: ProjectUser): MemberDto {
		return {
			id: projectMember.id,
			userInfo: this.userMapper.toUserDto(projectMember.user),
			role: projectMember.role,
			status: projectMember.status
		};
	}
}
