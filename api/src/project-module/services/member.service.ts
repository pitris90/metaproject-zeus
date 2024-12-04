import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProjectUser } from 'resource-manager-database';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { ProjectModel } from '../models/project.model';
import { MemberRequestDto } from '../dtos/input/member-request.dto';
import { MemberModel } from '../models/member.model';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { Sorting } from '../../config-module/decorators/get-sorting';
import { ProjectPermissionService } from './project-permission.service';

@Injectable()
export class MemberService {
	constructor(
		private readonly projectModel: ProjectModel,
		private readonly memberModel: MemberModel,
		private readonly dataSource: DataSource,
		private readonly projectPermissionService: ProjectPermissionService
	) {}

	async getProjectMembers(
		projectId: number,
		user: UserDto,
		pagination: Pagination,
		sorting: Sorting | null,
		isStepUp: boolean
	): Promise<[ProjectUser[], number]> {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, user.id, isStepUp);
		const project = await this.projectModel.getProject(projectId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) || !project) {
			throw new ProjectNotFoundApiException();
		}

		return this.memberModel.getProjectMembers(
			projectId,
			userPermissions.has(ProjectPermissionEnum.VIEW_ALL_MEMBERS),
			pagination,
			sorting
		);
	}

	async acceptInvitation(externalProjectId: number, userId: number) {
		const project = await this.projectModel.getProjectByExternalId(externalProjectId);

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		// TODO check if user is member of group in Perun before accepting invitation

		await this.memberModel.acceptInvitation(project.id, userId);
	}

	async addProjectMembers(
		projectId: number,
		userId: number,
		members: MemberRequestDto[],
		isStepUp: boolean
	): Promise<string[]> {
		const usesManagerRole = members.some((member) => member.role === 'manager');
		return await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				usesManagerRole ? ProjectPermissionEnum.EDIT_MANAGERS : ProjectPermissionEnum.EDIT_MEMBERS,
				isStepUp
			);

			const existingMembers = await this.memberModel.getMembersByEmail(
				projectId,
				members.map((member) => member.email)
			);

			const existingEmails = new Set(existingMembers.map((member) => member.user.email));
			const addedEmails: string[] = [];

			for (const member of members) {
				if (existingEmails.has(member.email)) {
					continue;
				}
				await this.memberModel.addMember(manager, projectId, member.email, member.role);
				addedEmails.push(member.email);
			}

			return addedEmails;
		});
	}

	async deleteProjectMember(projectId: number, userId: number, memberId: number, isStepUp: boolean) {
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.EDIT_MEMBERS,
				isStepUp
			);
			await this.memberModel.deleteMember(projectId, memberId);
		});
	}
}
