import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { TypeormConfigService } from 'resource-manager-database';
import { SeedModule } from './seeders-module/seed.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		TypeOrmModule.forRootAsync({
			useClass: TypeormConfigService
		} as TypeOrmModuleAsyncOptions),
		SeedModule
	]
})
export class AppModule {}
