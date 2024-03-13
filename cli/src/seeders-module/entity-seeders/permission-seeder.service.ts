import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Permission } from 'resource-manager-database';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class PermissionSeeder implements EntitySeederInterface<Permission> {
	public getInsertEntity(): EntityTarget<Permission> {
		return Permission;
	}

	public async getInsertElements(): Promise<QueryDeepPartialEntity<Permission>[]> {
		return [
			{ codeName: 'request_project', description: 'Allows user to request a new project' },
			{ codeName: 'get_owned_projects', description: 'Allows user to get all owned projects' }
		];
	}
}
