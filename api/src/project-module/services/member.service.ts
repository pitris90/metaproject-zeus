import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { MemberDto } from '../dtos/member.dto';
import { MemberMapper } from '../mappers/member.mapper';
import { ProjectModel } from '../models/project.model';
import { MemberRequestDto } from '../dtos/input/member-request.dto';
import { MemberModel } from '../models/member.model';
import { PerunUserService } from '../../perun-module/services/perun-user.service';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { ProjectPermissionService } from './project-permission.service';

@Injectable()
export class MemberService {
	constructor(
		private readonly projectModel: ProjectModel,
		private readonly memberModel: MemberModel,
		private readonly memberMapper: MemberMapper,
		private readonly dataSource: DataSource,
		private readonly perunUserService: PerunUserService,
		private readonly projectPermissionService: ProjectPermissionService
	) {}

	async getProjectMembers(projectId: number, user: UserDto): Promise<MemberDto[]> {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, user.id);
		const project = await this.projectModel.getProject(projectId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) || !project) {
			throw new ProjectNotFoundApiException();
		}

		const members = await this.memberModel.getProjectMembers(
			projectId,
			user.id,
			userPermissions.has(ProjectPermissionEnum.VIEW_ALL_MEMBERS)
		);
		return members.map((member) => this.memberMapper.toMemberDto(member));
	}

	async addProjectMembers(projectId: number, userId: number, members: MemberRequestDto[]) {
		const usesManagerRole = members.some((member) => member.role === 'manager');
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				usesManagerRole ? ProjectPermissionEnum.EDIT_MANAGERS : ProjectPermissionEnum.EDIT_MEMBERS
			);

			for (const member of members) {
				const perunUser = this.perunUserService.getUserById(member.id);

				if (!perunUser) {
					throw new Error(`User with id ${member.id} not found`);
				}

				await this.memberModel.addMember(manager, projectId, perunUser, member.role);
			}
		});
	}

	async deleteProjectMember(projectId: number, userId: number, memberId: number) {
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.EDIT_MEMBERS
			);
			await this.memberModel.deleteMember(projectId, memberId);
		});
	}
}
