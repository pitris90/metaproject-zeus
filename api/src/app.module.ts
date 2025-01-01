import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { TypeormConfigService } from 'resource-manager-database';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { BullModule } from '@nestjs/bullmq';
import { validationSchema } from '../config/validationSchema.config';
import { AppController } from './app.controller';
import { PermissionModule } from './permission-module/permission.module';
import { UsersModule } from './users-module/users.module';
import { AuthModule } from './auth-module/auth.module';
import { ProjectModule } from './project-module/project.module';
import { PublicationModule } from './publication-module/publication.module';
import { ResourceModule } from './resource-module/resource.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			validationSchema,
			isGlobal: true
		}),
		TypeOrmModule.forRootAsync({
			useClass: TypeormConfigService
		} as TypeOrmModuleAsyncOptions),
		CacheModule.register({
			isGlobal: true,
			store: redisStore,
			socket: {
				host: process.env['REDIS_HOST']!,
				port: process.env['REDIS_PORT']!
			},
			password: process.env['REDIS_PASSWORD']!
		}),
		BullModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => {
				return {
					connection: {
						host: configService.getOrThrow('REDIS_HOST'),
						port: configService.getOrThrow('REDIS_PORT'),
						password: configService.getOrThrow('REDIS_PASSWORD')
					}
				};
			},
			inject: [ConfigService]
		}),
		AuthModule,
		PermissionModule,
		UsersModule,
		ProjectModule,
		PublicationModule,
		ResourceModule
	],
	controllers: [AppController]
})
export class AppModule {}
