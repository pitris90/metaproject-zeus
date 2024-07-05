import { DataSource, QueryFailedError } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EntitySeederInterface } from './entity-seeders/entity-seeder.interface';
import { PermissionSeeder } from './entity-seeders/permission-seeder.service';
import { RoleSeeder } from './entity-seeders/role-seeder.service';
import { RolePermissionSeeder } from './entity-seeders/role-permission-seeder.service';
import { ResourceTypeSeeder } from './entity-seeders/resource-type-seeder.service';

@Injectable()
export class SeedCommand {
	private readonly seeders: EntitySeederInterface<any>[] = [];

	constructor(
		private readonly dataSource: DataSource,
		readonly permissionSeeder: PermissionSeeder,
		readonly roleSeeder: RoleSeeder,
		readonly rolePermissionSeeder: RolePermissionSeeder,
		readonly resourceTypeSeeder: ResourceTypeSeeder
	) {
		this.seeders = [permissionSeeder, roleSeeder, rolePermissionSeeder, resourceTypeSeeder];
	}

	async run(): Promise<void> {
		for (const seeder of this.seeders) {
			const entity = seeder.getInsertEntity();
			const insertElements = await seeder.getInsertElements();
			console.log(`Seeding data for ${this.getClassName(entity.toString())}...`);
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

	private getClassName(entity: string): string {
		return entity.split('class ')[1].split(' ')[0];
	}
}
