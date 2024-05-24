import { Injectable } from '@nestjs/common';
import { ProjectStatus } from 'resource-manager-database';
import { DataSource } from 'typeorm';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberDto } from '../dtos/member.dto';
import { MemberMapper } from '../mappers/member.mapper';
import { ProjectModel } from '../models/project.model';
import { MemberRequestDto } from '../dtos/input/member-request.dto';
import { ProjectInvalidStatusApiException } from '../../error-module/errors/projects/project-invalid-status.api-exception';
import { MemberModel } from '../models/member.model';

@Injectable()
export class MemberService {
	constructor(
		private readonly projectModel: ProjectModel,
		private readonly memberModel: MemberModel,
		private readonly memberMapper: MemberMapper,
		private readonly dataSource: DataSource
	) {}

	async getProjectMembers(projectId: number, user: UserDto): Promise<MemberDto[]> {
		const project = await this.projectModel.getUserProject(projectId, user.id, null, false);

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		const members = await this.memberModel.getProjectMembers(projectId, user.id);
		return members.map((member) => this.memberMapper.toMemberDto(member));
	}

	async addProjectMembers(projectId: number, userId: number, members: MemberRequestDto[]) {
		const project = await this.projectModel.getUserProject(projectId, userId, null, true);

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		if (project.status !== ProjectStatus.ACTIVE && project.status !== ProjectStatus.NEW) {
			throw new ProjectInvalidStatusApiException();
		}

		await this.dataSource.transaction(async (manager) => {
			for (const member of members) {
				await this.memberModel.addMember(manager, projectId, member);
			}
		});
	}
}
