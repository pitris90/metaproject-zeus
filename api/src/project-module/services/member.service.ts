import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Project } from 'resource-manager-database';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberDto } from '../dtos/member.dto';
import { MemberMapper } from '../mappers/member.mapper';

@Injectable()
export class MemberService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly memberMapper: MemberMapper
	) {}

	async getProjectMembers(projectId: number, user: UserDto): Promise<MemberDto[]> {
		const project = await this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.leftJoinAndSelect('project.members', 'members')
			.where('project.id = :projectId', { projectId })
			.where('pi.id = :piId OR members.user = :userId', { piId: user.id, userId: user.id })
			.getOne();

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
