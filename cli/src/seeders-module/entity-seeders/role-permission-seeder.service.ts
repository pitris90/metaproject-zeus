import { Injectable } from '@nestjs/common';
import { DataSource, EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Permission } from 'resource-manager-database/dist/models/user/permission';
import { RolePermission } from 'resource-manager-database/dist/models/user/role-permission';
import { Role } from 'resource-manager-database/dist/models/user/role';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class RolePermissionSeeder implements EntitySeederInterface<RolePermission> {
	// role code_name -> list of permission code_name
	private readonly rolePermissionMapping: Record<string, string[]> = {
		user: ['request_project']
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
					roleId: role.id,
					permissionId: permission.id
				});
			}
		}

		return toInsert;
	}
}
