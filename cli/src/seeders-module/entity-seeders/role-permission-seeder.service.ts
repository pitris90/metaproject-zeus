import { Injectable } from '@nestjs/common';
import { DataSource, EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Permission, Role, RolePermission } from 'resource-manager-database';
import { EntitySeederInterface } from './entity-seeder.interface';

const USER_PERMISSIONS = ['request_project', 'get_owned_projects', 'manipulate_owned_projects'];
const DIRECTOR_PERMISSIONS = [...USER_PERMISSIONS, 'get_all_projects'];
const ADMIN_PERMISSIONS = [...DIRECTOR_PERMISSIONS, 'manipulate_all_projects', 'close_project', 'project_approval'];

@Injectable()
export class RolePermissionSeeder implements EntitySeederInterface<RolePermission> {
	// role code_name -> list of permission code_name
	private readonly rolePermissionMapping: Record<string, string[]> = {
		user: USER_PERMISSIONS,
		director: DIRECTOR_PERMISSIONS,
		admin: ADMIN_PERMISSIONS
	};

	constructor(private readonly dataSource: DataSource) {}

	public getInsertEntity(): EntityTarget<RolePermission> {
		return RolePermission;
	}

	public async getInsertElements(): Promise<QueryDeepPartialEntity<RolePermission>[]> {
		return this.getRolePermissionsByMapping();
	}

	private async getRolePermissionsByMapping(): Promise<QueryDeepPartialEntity<RolePermission>[]> {
		const toInsert: QueryDeepPartialEntity<RolePermission>[] = [];
		for (const roleCodeName in this.rolePermissionMapping) {
			const role = await this.dataSource
				.createQueryBuilder()
				.select('role.id')
				.from(Role, 'role')
				.where('role.codeName = :codeName', { codeName: roleCodeName })
				.getOne();

			if (!role) {
				throw new Error(`Role with codeName ${roleCodeName} not found`);
			}

			for (const permissionCodeName of this.rolePermissionMapping[roleCodeName]) {
				const permission = await this.dataSource
					.createQueryBuilder()
					.select('permission.id')
					.from(Permission, 'permission')
					.where('permission.codeName = :codeName', { codeName: permissionCodeName })
					.getOne();

				if (!permission) {
					throw new Error(`Permission with codeName ${permissionCodeName} not found`);
				}

				toInsert.push({
					roleId: role['id'],
					permissionId: permission['id']
				});
			}
		}

		return toInsert;
	}
}
