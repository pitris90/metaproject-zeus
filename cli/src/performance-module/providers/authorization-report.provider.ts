import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportProvider } from './report-provider.interface';

@Injectable()
export class AuthorizationReportProvider extends ReportProvider {
	constructor(dataSource: DataSource) {
		super(dataSource);
	}

	override getTemplate(): string {
		return '/auth';
	}

	async getEndpoint(): Promise<string> {
		return '/auth';
	}

	getBody(): Record<string, string> {
		return {};
	}

	getMethod(): string {
		return 'GET';
	}
}
