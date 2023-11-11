import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from '../config/validationSchema.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeormConfigService } from './config-module/database/typeorm.config';
import { ApiConfigModule } from './config-module/api-config.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			validationSchema,
			isGlobal: true
		}),
		TypeOrmModule.forRootAsync({
			name: 'resourceBackendConnection',
			imports: [ApiConfigModule],
			useExisting: TypeormConfigService
		})
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
