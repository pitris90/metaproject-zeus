import { DataSource, QueryFailedError } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EntitySeederInterface } from './entity-seeders/entity-seeder.interface';
import { PermissionSeeder } from './entity-seeders/permission-seeder.service';
import { RoleSeeder } from './entity-seeders/role-seeder.service';

@Injectable()
export class SeedCommand {
	private readonly seeders: EntitySeederInterface<any>[] = [];

	constructor(
		private readonly dataSource: DataSource,
		readonly permissionSeeder: PermissionSeeder,
		readonly roleSeeder: RoleSeeder
	) {
		this.seeders = [permissionSeeder, roleSeeder];
	}

	async run(): Promise<void> {
		for (const seeder of this.seeders) {
			try {
				const entity = seeder.getInsertEntity();
				console.log(`Seeding data for ${this.getClassName(entity.toString())}...`);
				await this.dataSource
					.createQueryBuilder()
					.insert()
					.into(entity)
					.values(seeder.getInsertElements())
					.execute();
				console.log(`-- Done.`);
			} catch (e) {
				// error is because of duplicate value, we want to continue because seed arealy ran
				if (
					e instanceof QueryFailedError &&
					e.message.includes('duplicate key value violates unique constraint')
				) {
					console.log(`-- Table already contains data. Skipping...`);
					continue;
				}

				throw e;
			}
		}
	}

	private getClassName(entity: string): string {
		return entity.split('class ')[1].split(' ')[0];
	}
}
