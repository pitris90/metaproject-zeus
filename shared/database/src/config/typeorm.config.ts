import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DatabaseFactory } from './database.factory';

@Injectable()
export class TypeormConfigService implements TypeOrmOptionsFactory {
	createTypeOrmOptions(): TypeOrmModuleOptions {
		const database = (new DatabaseFactory()).create();

		return {
			type: 'postgres',
			host: database.host,
			port: database.port,
			username: database.username,
			password: database.password,
			database: database.database,
			entities: [],
			autoLoadEntities: true,
			synchronize: process.env['APPLICATION_MODE'] === 'development',
			keepConnectionAlive: process.env['APPLICATION_MODE'] == 'test'
		};
	}
}
