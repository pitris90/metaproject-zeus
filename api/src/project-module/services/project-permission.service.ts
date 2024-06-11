import { Injectable } from '@nestjs/common';
import { ProjectModel } from '../models/project.model';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UsersModel } from '../../users-module/models/users.model';
import { InvalidUserApiException } from '../../error-module/errors/users/invalid-user.api-exception';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { MemberModel } from '../models/member.model';

@Injectable()
export class ProjectPermissionService {
	public constructor(
		private readonly projectModel: ProjectModel,
		private readonly memberModel: MemberModel,
		private readonly userModel: UsersModel
	) {}

	/**
	 * Get permissions for users for specific project. Shouldn't be used when manipulating project in transaction, only for returning
	 * permissions for showing elements in UI.
	 *
	 * @param projectId ID of the project
	 * @param userId ID of the user
	 */
	async getUserPermissions(projectId: number, userId: number) {
		const project = await this.projectModel.getProject(projectId);

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		const user = await this.userModel.findUserById(userId);

		if (!user) {
			throw new InvalidUserApiException();
		}

		// if user is admin or PI of the project, he has all permissions
		if (user.role.codeName === RoleEnum.ADMIN || project.pi.id === userId) {
			return [
				ProjectPermissionEnum.EDIT_PROJECT,
				ProjectPermissionEnum.VIEW_PROJECT,
				ProjectPermissionEnum.EDIT_PUBLICATIONS,
				ProjectPermissionEnum.EDIT_MEMBERS,
				ProjectPermissionEnum.EDIT_MANAGERS
			];
		}

		// if user is manager of the project, he has all permissions except editing members
		const isManager = await this.memberModel.isUserManager(projectId, userId);
		if (isManager) {
			return [
				ProjectPermissionEnum.VIEW_PROJECT,
				ProjectPermissionEnum.EDIT_PUBLICATIONS,
				ProjectPermissionEnum.EDIT_MEMBERS
			];
		}

		// director and member can only view project
		if (user.role.codeName === RoleEnum.DIRECTOR || project.members.map((member) => member.id).includes(userId)) {
			return [ProjectPermissionEnum.VIEW_PROJECT];
		}

		// otherwise we are pretending project does not exist
		throw new ProjectNotFoundApiException();
	}
}
