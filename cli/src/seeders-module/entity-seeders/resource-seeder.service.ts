import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Resource, ResourceType } from 'resource-manager-database';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class ResourceSeeder implements EntitySeederInterface<Resource> {
	constructor(private readonly dataSource: DataSource) {}

	public getInsertEntity(): string {
		return Resource.name;
	}

	public async getInsertElements(): Promise<QueryDeepPartialEntity<Resource>[]> {
		const openstackResourceType = await this.dataSource
			.getRepository(ResourceType)
			.findOne({ where: { name: 'OpenStack cloud' } });

		if (!openstackResourceType) {
			throw new Error('Resource type "OpenStack cloud" must exist before seeding resources.');
		}

		return [
			{
				name: 'OpenStack',
				description: 'OpenStack projects managed via GitOps automation',
				isAvailable: true,
				resourceTypeId: openstackResourceType.id
			}
		];
	}
}
