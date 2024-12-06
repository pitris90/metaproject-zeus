import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { ReportProvider } from './report-provider.interface';

@Injectable()
export class RequestProjectProvider extends ReportProvider {
	constructor(dataSource: DataSource) {
		super(dataSource);
	}

	override getTemplate(): string {
		return '/project';
	}

	override async getEndpoint(): Promise<string> {
		return '/project';
	}
	override getBody(): Record<string, string> {
		return {
			title: faker.lorem.word({
				length: { min: 6, max: 15 }
			}),
			link: faker.internet.url(),
			description: faker.lorem.paragraph()
		};
	}
	override getMethod(): string {
		return 'POST';
	}
}
