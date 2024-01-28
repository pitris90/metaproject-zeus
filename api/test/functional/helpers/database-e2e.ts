import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

export class TypeormE2EConfigService implements TypeOrmOptionsFactory {
	createTypeOrmOptions(): TypeOrmModuleOptions {
		return {
			type: 'postgres',
			host: 'postgres',
			port: 5432,
			username: 'test',
			password: 'test',
			database: 'resource-manager',
			dropSchema: true,
			synchronize: true
		};
	}
}
