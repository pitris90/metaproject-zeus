import { DataSource, QueryFailedError } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EntitySeederInterface } from './entity-seeders/entity-seeder.interface';
import { RoleSeeder } from './entity-seeders/role-seeder.service';
import { ResourceTypeSeeder } from './entity-seeders/resource-type-seeder.service';
import { AttributeTypeSeeder } from './entity-seeders/attribute-type-seeder.service';
import { ResourceAttributeTypeSeeder } from './entity-seeders/resource-attribute-type-seeder.service';

@Injectable()
export class SeedCommand {
	private readonly seeders: EntitySeederInterface<any>[] = [];

	constructor(
		private readonly dataSource: DataSource,
		readonly roleSeeder: RoleSeeder,
		readonly resourceTypeSeeder: ResourceTypeSeeder,
		readonly attributeTypeSeeder: AttributeTypeSeeder,
		readonly resourceAttributeTypeSeeder: ResourceAttributeTypeSeeder
	) {
		this.seeders = [roleSeeder, resourceTypeSeeder, attributeTypeSeeder, resourceAttributeTypeSeeder];
	}

	async run(): Promise<void> {
		for (const seeder of this.seeders) {
			const entity = seeder.getInsertEntity();
			const insertElements = await seeder.getInsertElements();
			console.log(`Seeding data for entity "${entity}"...`);
			for (const element of insertElements) {
				try {
					console.log(`-- Inserting ${JSON.stringify(element)}...`);
					await this.dataSource.createQueryBuilder().insert().into(entity).values(element).execute();
				} catch (e) {
					// error is because of duplicate value, we want to continue because seed arealy ran
					if (
						e instanceof QueryFailedError &&
						e.message.includes('duplicate key value violates unique constraint')
					) {
						console.log(`---- Table already contains ${JSON.stringify(element)} data. Skipping...`);
						continue;
					}

					throw e;
				}
			}
		}

		console.log(`-- Done.`);
	}
}
