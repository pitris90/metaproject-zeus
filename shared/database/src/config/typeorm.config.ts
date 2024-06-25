import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DatabaseFactory } from './database.factory';
import { Permission } from '../models/user/permission';
import { Injectable } from '@nestjs/common';
import { Role } from '../models/user/role';
import { User } from '../models/user/user';
import { RolePermission } from '../models/user/role-permission';
import { Project } from '../models/project/project';
import { ProjectApproval } from '../models/project/project-approval';
import { ProjectUser } from '../models/project/project-user';
import { ResourceType } from '../models/resource/resource-type';
import { Resource } from '../models/resource/resource';
import { ProjectArchival } from '../models/project/project-archival';

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
				RolePermission,
				User,
				// project
				Project,
				ProjectApproval,
				ProjectArchival,
				ProjectUser,
				// resources
				ResourceType,
				Resource
			],
			autoLoadEntities: true,
			synchronize: process.env['APPLICATION_MODE'] === 'development',
			keepConnectionAlive: process.env['APPLICATION_MODE'] == 'test'
		} as TypeOrmModuleOptions;
	}
}
