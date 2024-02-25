import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DatabaseFactory } from './database.factory';
import { Permission } from '../models/user/permission';
import { Injectable } from '@nestjs/common';
import { Role } from '../models/user/role';
import { User } from '../models/user/user';

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
			entities: [
				// user
				Permission,
				Role,
				User
			],
			autoLoadEntities: true,
			synchronize: process.env['APPLICATION_MODE'] === 'development',
			keepConnectionAlive: process.env['APPLICATION_MODE'] == 'test'
		} as TypeOrmModuleOptions;
	}
}
