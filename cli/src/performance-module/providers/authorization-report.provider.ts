import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from 'resource-manager-database';
import { ReportProvider } from './report-provider.interface';

@Injectable()
export class AuthorizationReportProvider implements ReportProvider {
	private externalId: string;

	constructor(private readonly dataSource: DataSource) {}

	getEndpoint(): string {
		return '/auth';
	}

	async getHeaders(): Promise<Record<string, string>> {
		if (!this.externalId) {
			const user = await this.dataSource
				.getRepository(User)
				.createQueryBuilder('user')
				.select()
				.orderBy('RANDOM()')
				.getOneOrFail();
			this.externalId = user.externalId;
		}

		return {
			Authorization: `Bearer ${this.externalId}`
		};
	}

	getBody(): Record<string, string> {
		return {};
	}

	getMethod(): string {
		return 'GET';
	}
}
