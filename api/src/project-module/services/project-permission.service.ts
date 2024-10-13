import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
	Project,
	ProjectStatus,
	ProjectUser,
	ProjectUserRole,
	ProjectUserStatus,
	RolePermission,
	User
} from 'resource-manager-database';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { InvalidUserApiException } from '../../error-module/errors/users/invalid-user.api-exception';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { InvalidPermissionException } from '../exceptions/invalid-permission.exception';

@Injectable()
export class ProjectPermissionService {
	public constructor(private readonly dataSource: DataSource) {}

	async getUserPermissions(projectId: number, userId: number) {
		const manager = this.dataSource.manager;
		return this.userPermissionsHelper(manager, projectId, userId);
	}

	/**
	 * Validate if user has specific permission for project. If not, throw exception.
	 *
	 * @param manager transaction manager
	 * @param projectId ID of the project
	 * @param userId ID of the user
	 * @param permission permission to validate
	 */
	async validateUserPermissions(
		manager: EntityManager,
		projectId: number,
		userId: number,
		permission: ProjectPermissionEnum
	) {
		const userPermissions = await this.userPermissionsHelper(manager, projectId, userId);

		if (!userPermissions.has(permission)) {
			throw new InvalidPermissionException(permission);
		}
	}

	/**
	 * Get permissions for users for specific project. Could be used when manipulating for transactions and for returning
	 * permissions for showing elements in UI.
	 *
	 * @param manager entity manager from potential transaction
	 * @param projectId ID of the project
	 * @param userId ID of the user
	 */
	private async userPermissionsHelper(manager: EntityManager, projectId: number, userId: number) {
		const project = await manager.getRepository(Project).findOne({
			relations: {
				pi: true
			},
			where: {
				id: projectId
			}
		});

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		const user = await manager.getRepository(User).findOne({
			relations: {
				role: {
					permissionsToRole: {
						permission: true
					}
				}
			},
			where: {
				id: userId
			}
		});

		if (!user) {
			throw new InvalidUserApiException();
		}

		// fill with default permissions
		const permissions = new Set(this.getDefaultPermissions(user.role.permissionsToRole));

		// user is PI
		if (project.pi.id === userId) {
			this.addManagerPermissions(permissions);
			permissions.add(ProjectPermissionEnum.EDIT_PROJECT);
			permissions.add(ProjectPermissionEnum.EDIT_MANAGERS);

			// project is inactive, can't edit it anymore
			if (project.status === ProjectStatus.ARCHIVED) {
				this.removeEditPermissions(permissions);
			}

			// project is rejected - can edit only title and description
			if (project.status === ProjectStatus.REJECTED) {
				permissions.add(ProjectPermissionEnum.EDIT_PROJECT);
			}
			return permissions;
		}

		const memberInfo = await manager.getRepository(ProjectUser).findOneBy({
			projectId,
			userId
		});

		// user is active part of the project
		if (memberInfo && memberInfo.status === ProjectUserStatus.ACTIVE) {
			if (memberInfo.role === ProjectUserRole.MANAGER) {
				// user is manager
				this.addManagerPermissions(permissions);
			} else {
				// user is normal active member
				permissions.add(ProjectPermissionEnum.VIEW_PROJECT);
				permissions.add(ProjectPermissionEnum.REQUEST_ALLOCATION);
			}
		}

		// project is inactive, can't edit it anymore
		if (project.status === ProjectStatus.REJECTED || project.status === ProjectStatus.ARCHIVED) {
			this.removeEditPermissions(permissions);
		}

		return permissions;
	}

	private getDefaultPermissions(permissionsToRole: RolePermission[]): ProjectPermissionEnum[] {
		return permissionsToRole.flatMap((rolePermission) => {
			if (rolePermission.permission.codeName === PermissionEnum.GET_ALL_PROJECTS) {
				return [
					ProjectPermissionEnum.VIEW_PROJECT,
					ProjectPermissionEnum.VIEW_ADVANCED_DETAILS,
					ProjectPermissionEnum.VIEW_ALL_MEMBERS,
					ProjectPermissionEnum.VIEW_ALL_ALLOCATIONS
				];
			}

			if (rolePermission.permission.codeName === PermissionEnum.MANIPULATE_ALL_PROJECTS) {
				return [
					ProjectPermissionEnum.EDIT_PROJECT,
					ProjectPermissionEnum.EDIT_PUBLICATIONS,
					ProjectPermissionEnum.EDIT_MEMBERS,
					ProjectPermissionEnum.EDIT_MANAGERS
				];
			}

			return [];
		});
	}

	private addManagerPermissions(permissions: Set<ProjectPermissionEnum>) {
		permissions.add(ProjectPermissionEnum.REQUEST_ALLOCATION);
		permissions.add(ProjectPermissionEnum.VIEW_PROJECT);
		permissions.add(ProjectPermissionEnum.EDIT_PUBLICATIONS);
		permissions.add(ProjectPermissionEnum.EDIT_MEMBERS);
		permissions.add(ProjectPermissionEnum.VIEW_ALL_MEMBERS);
		permissions.add(ProjectPermissionEnum.VIEW_ALL_ALLOCATIONS);
		permissions.add(ProjectPermissionEnum.VIEW_ADVANCED_DETAILS);
	}

	private removeEditPermissions(permissions: Set<ProjectPermissionEnum>) {
		permissions.delete(ProjectPermissionEnum.EDIT_PROJECT);
		permissions.delete(ProjectPermissionEnum.EDIT_PUBLICATIONS);
		permissions.delete(ProjectPermissionEnum.EDIT_MEMBERS);
		permissions.delete(ProjectPermissionEnum.REQUEST_ALLOCATION);
		permissions.delete(ProjectPermissionEnum.EDIT_MANAGERS);
	}
}
