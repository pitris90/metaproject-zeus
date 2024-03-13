import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Role } from 'resource-manager-database';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class RoleSeeder implements EntitySeederInterface<Role> {
	public getInsertEntity(): EntityTarget<Role> {
		return Role;
	}

	public async getInsertElements(): Promise<QueryDeepPartialEntity<Role>[]> {
		return [{ codeName: 'user', name: 'User' }];
	}
}
