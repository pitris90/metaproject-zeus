import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Database } from 'resource-manager-database';
import { ApplicationMode } from './config-options/application-mode.enum';

@Injectable()
export class ApiConfigService {
	constructor(private configService: ConfigService) {}

	get applicationMode(): ApplicationMode {
		const application = this.configService.get('APPLICATION_MODE');
		switch (application) {
			case 'development':
				return ApplicationMode.DEVELOPMENT;
			case 'production':
				return ApplicationMode.PRODUCTION;
			case 'test':
				return ApplicationMode.TEST;
			default:
				throw new NotImplementedException("Invalid configuration option 'APPLICATION_MODE'");
		}
	}

	get database(): Database {
		const host = this.configService.get('POSTGRES_HOST');
		const port = this.configService.get('POSTGRES_PORT');
		const username = this.configService.get('POSTGRES_USER');
		const password = this.configService.get('POSTGRES_PASSWORD');
		const database = this.configService.get('POSTGRES_DATABASE');

		if (!host || !port || !username || !database || !password) {
			throw new Error(`Invalid database configuration: postgresql://${username}@${host}:${port}/${database}`);
		}

		return new Database(host, port, username, password, database);
	}

	get corsOrigin(): string[] {
		return this.configService.get('CORS_ALLOW_ORIGIN').split(',');
	}
}
