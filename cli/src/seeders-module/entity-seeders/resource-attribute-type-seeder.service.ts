import { Injectable } from '@nestjs/common';
import { ResourceAttributeType } from 'resource-manager-database';
import { EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class ResourceAttributeTypeSeeder implements EntitySeederInterface<ResourceAttributeType> {
	getInsertEntity(): EntityTarget<ResourceAttributeType> {
		return ResourceAttributeType;
	}

	async getInsertElements(): Promise<QueryDeepPartialEntity<ResourceAttributeType>[]> {
		return [
			{ name: 'quantity_default_value', isPublic: true, attributeTypeId: 3 },
			{ name: 'quantity_label', isPublic: true, attributeTypeId: 4 },
			{ name: 'Core Count', attributeTypeId: 3 },
			{ name: 'Node Count', attributeTypeId: 3 },
			{ name: 'Owner', attributeTypeId: 4 },
			{ name: 'Vendor', attributeTypeId: 4 },
			{ name: 'Model', attributeTypeId: 4 },
			{ name: 'Serial Number', attributeTypeId: 4 }
		];
	}
}
