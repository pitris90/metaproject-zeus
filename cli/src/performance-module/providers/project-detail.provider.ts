import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Project, ProjectUser, User } from 'resource-manager-database';
import { ReportProvider } from './report-provider.interface';

@Injectable()
export class ProjectDetailProvider extends ReportProvider {
	private isUserPi: boolean;

	constructor(dataSource: DataSource) {
		super(dataSource);
	}

	override getTemplate(): string {
		return '/project/:id';
	}

	override async getEndpoint(): Promise<string> {
		let savedUserId = this.savedUser?.id;
		if (!savedUserId) {
			const user = await this.getRandomUser();
			savedUserId = user.id;
			this.savedUser = user;
		}

		if (this.isUserPi) {
			const project = await this.dataSource
				.getRepository(Project)
				.createQueryBuilder('p')
				.select()
				.where('pi_id = :userId', { userId: savedUserId })
				.orderBy('RANDOM()')
				.getOneOrFail();

			return `/project/${project.id}`;
		}

		const projectUser = await this.dataSource
			.getRepository(ProjectUser)
			.createQueryBuilder('pu')
			.select()
			.innerJoinAndSelect('pu.project', 'project')
			.where('pu.userId = :userId', { userId: savedUserId })
			.orderBy('RANDOM()')
			.getOneOrFail();

		return `/project/${projectUser.project.id}`;
	}
	override getBody(): Record<string, string> {
		return {};
	}
	override getMethod(): string {
		return 'GET';
	}

	override async getRandomUser(): Promise<User> {
		const projectUser = await this.dataSource
			.getRepository(ProjectUser)
			.createQueryBuilder('pu')
			.select()
			.innerJoinAndSelect('pu.user', 'user')
			.orderBy('RANDOM()')
			.getOne();

		if (projectUser) {
			this.isUserPi = false;
			return projectUser.user;
		}

		const project = await this.dataSource
			.getRepository(Project)
			.createQueryBuilder('project')
			.select()
			.innerJoinAndSelect('project.pi', 'pi')
			.orderBy('RANDOM()')
			.getOneOrFail();

		this.isUserPi = true;
		return project.pi;
	}
}
