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
		sorting: Sorting | null
	): Promise<[ProjectUser[], number]> {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, user.id);
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
				await this.memberModel.addMember(manager, projectId, member.email, member.role);
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
