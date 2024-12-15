import { Injectable } from '@nestjs/common';
import { AttributeType } from 'resource-manager-database';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EntitySeederInterface } from './entity-seeder.interface';

@Injectable()
export class AttributeTypeSeeder implements EntitySeederInterface<AttributeType> {
	getInsertEntity(): string {
		return AttributeType.name;
	}

	async getInsertElements(): Promise<QueryDeepPartialEntity<AttributeType>[]> {
		return [
			{ id: 1, name: 'Active/Inactive' },
			{ id: 2, name: 'Date' },
			{ id: 3, name: 'Int' },
			{ id: 4, name: 'Text' },
			{ id: 5, name: 'Yes/No' },
			{ id: 6, name: 'Float' }
		];
	}
}
