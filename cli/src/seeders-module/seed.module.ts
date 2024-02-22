import { Module } from '@nestjs/common';
import { SeedCommand } from './seed.command';
import { PermissionSeeder } from './entity-seeders/permission-seeder.service';

@Module({
	providers: [SeedCommand, PermissionSeeder],
	exports: [SeedCommand]
})
export class SeedModule {}
