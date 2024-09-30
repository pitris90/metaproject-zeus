import { Module } from '@nestjs/common';
import { SeedCommand } from './seed.command';
import { PermissionSeeder } from './entity-seeders/permission-seeder.service';
import { RoleSeeder } from './entity-seeders/role-seeder.service';
import { RolePermissionSeeder } from './entity-seeders/role-permission-seeder.service';
import { ResourceTypeSeeder } from './entity-seeders/resource-type-seeder.service';
import { AttributeTypeSeeder } from './entity-seeders/attribute-type-seeder.service';
import { ResourceAttributeTypeSeeder } from './entity-seeders/resource-attribute-type-seeder.service';

@Module({
	providers: [
		SeedCommand,
		PermissionSeeder,
		RoleSeeder,
		RolePermissionSeeder,
		ResourceTypeSeeder,
		AttributeTypeSeeder,
		ResourceAttributeTypeSeeder
	],
	exports: [SeedCommand]
})
export class SeedModule {}
