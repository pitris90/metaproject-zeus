import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeormConfigService } from 'resource-manager-database';
import { validationSchema } from '../config/validationSchema.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PermissionModule } from './permission-module/permission.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			validationSchema,
			isGlobal: true
		}),
		TypeOrmModule.forRootAsync({
			name: 'resourceBackendConnection',
			useClass: TypeormConfigService
		}),
		PermissionModule
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
