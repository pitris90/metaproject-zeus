import { ApiConfigService } from '../api-config.service';
import { ApplicationMode } from '../config-options/application-mode.enum';
import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeormConfigService implements TypeOrmOptionsFactory{
	constructor(private apiConfigService: ApiConfigService) {}
	createTypeOrmOptions(): TypeOrmModuleOptions {
		return {
			type: "postgres",
			host: this.apiConfigService.database.host,
			port: this.apiConfigService.database.port,
			username: this.apiConfigService.database.username,
			password: this.apiConfigService.database.password,
			database: this.apiConfigService.database.database,
			entities: [],
			autoLoadEntities: true,
			synchronize: this.apiConfigService.applicationMode !== ApplicationMode.PRODUCTION,
			keepConnectionAlive: this.apiConfigService.applicationMode == ApplicationMode.TEST,
		};
	}
}
