import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

	get corsOrigin(): string[] {
		return this.configService.get('CORS_ALLOW_ORIGIN').split(',');
	}
}
