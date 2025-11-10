import { Injectable } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ResourceType } from 'resource-manager-database';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class ResourceTypeSeeder implements EntitySeederInterface<ResourceType> {
	public getInsertEntity(): string {
		return ResourceType.name;
	}

	public async getInsertElements(): Promise<QueryDeepPartialEntity<ResourceType>[]> {
		return [
			{ name: 'Cloud', description: 'Cloud Computing' },
			{ name: 'OpenStack cloud', description: 'OpenStack cloud resources' },
			{ name: 'Cluster', description: 'Cluster servers' },
			{ name: 'Cluster partition', description: 'Cluster partition' },
			{ name: 'Compute node', description: 'Compute Node' },
			{ name: 'Server', description: 'Extra servers providing various services' },
			{ name: 'Software licence', description: 'Software License' },
			{ name: 'Storage', description: 'NAS storage' }
		];
	}
}
