import { Injectable } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Role } from 'resource-manager-database';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class RoleSeeder implements EntitySeederInterface<Role> {
	public getInsertEntity(): string {
		return Role.name;
	}

	public async getInsertElements(): Promise<QueryDeepPartialEntity<Role>[]> {
		return [
			{ codeName: 'user', name: 'User' },
			{ codeName: 'director', name: 'Director' },
			{ codeName: 'admin', name: 'Admin' }
		];
	}
}
