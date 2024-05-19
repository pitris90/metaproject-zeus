import { Injectable } from '@nestjs/common';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberDto } from '../dtos/member.dto';
import { MemberMapper } from '../mappers/member.mapper';
import { ProjectModel } from '../models/project.model';

@Injectable()
export class MemberService {
	constructor(
		private readonly projectModel: ProjectModel,
		private readonly memberMapper: MemberMapper
	) {}

	async getProjectMembers(projectId: number, user: UserDto): Promise<MemberDto[]> {
		const project = await this.projectModel.getUserProject(projectId, user.id, null, false);

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		if (!project.members) {
			return [];
		}

		// TODO user with user role and basic role in project can see only active members

		return project.members.map(this.memberMapper.toMemberDto);
	}
}
