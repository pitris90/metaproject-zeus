import { Module } from '@nestjs/common';
import { SeedCommand } from './seed.command';
import { RoleSeeder } from './entity-seeders/role-seeder.service';
import { ResourceTypeSeeder } from './entity-seeders/resource-type-seeder.service';
import { AttributeTypeSeeder } from './entity-seeders/attribute-type-seeder.service';
import { ResourceAttributeTypeSeeder } from './entity-seeders/resource-attribute-type-seeder.service';
import { ResourceSeeder } from './entity-seeders/resource-seeder.service';

@Module({
	providers: [
		SeedCommand,
		RoleSeeder,
		ResourceTypeSeeder,
		ResourceSeeder,
		AttributeTypeSeeder,
		ResourceAttributeTypeSeeder
	],
	exports: [SeedCommand]
})
export class SeedModule {}
