import { Module } from '@nestjs/common';
import { SeedCommand } from './seed.command';
import { PermissionSeeder } from './entity-seeders/permission-seeder.service';
import { RoleSeeder } from './entity-seeders/role-seeder.service';

@Module({
	providers: [SeedCommand, PermissionSeeder, RoleSeeder],
	exports: [SeedCommand]
})
export class SeedModule {}
