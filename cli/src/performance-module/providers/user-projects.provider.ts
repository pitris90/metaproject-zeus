import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Project, User } from 'resource-manager-database';
import { ReportProvider } from './report-provider.interface';

@Injectable()
export class UserProjectsProvider extends ReportProvider {
	constructor(dataSource: DataSource) {
		super(dataSource);
	}

	override getTemplate(): string {
		return '/project';
	}

	override async getEndpoint(): Promise<string> {
		const page = this.getRandomPage(1, 100);
		return `/project?status=active&page=${page}`;
	}
	override getBody(): Record<string, string> {
		return {};
	}
	override getMethod(): string {
		return 'GET';
	}

	override async getRandomUser(): Promise<User> {
		const project = await this.dataSource
			.getRepository(Project)
			.createQueryBuilder('project')
			.select()
			.innerJoinAndSelect('project.pi', 'pi')
			.orderBy('RANDOM()')
			.getOneOrFail();
		return project.pi;
	}

	private getRandomPage(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}
}
