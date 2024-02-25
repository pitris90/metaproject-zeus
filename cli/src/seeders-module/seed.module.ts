import { Module } from '@nestjs/common';
import { SeedCommand } from './seed.command';
import { PermissionSeeder } from './entity-seeders/permission-seeder.service';
import { RoleSeeder } from './entity-seeders/role-seeder.service';
import { RolePermissionSeeder } from './entity-seeders/role-permission-seeder.service';

@Module({
	providers: [SeedCommand, PermissionSeeder, RoleSeeder, RolePermissionSeeder],
	exports: [SeedCommand]
})
export class SeedModule {}
