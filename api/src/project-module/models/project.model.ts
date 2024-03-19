import { Injectable } from '@nestjs/common';
import { Project, ProjectStatus, User } from 'resource-manager-database';
import { EntityManager } from 'typeorm';
import { RequestProjectDto } from '../dtos/request-project.dto';

@Injectable()
export class ProjectModel {
	public async createProject(
		manager: EntityManager,
		requestProjectDto: RequestProjectDto,
		user: User
	): Promise<number> {
		const status = ProjectStatus.NEW;
		const result = await manager
			.createQueryBuilder()
			.insert()
			.into(Project)
			.values({
				title: requestProjectDto.title,
				description: requestProjectDto.description,
				status,
				pi: user
			})
			.execute();

		return result.identifiers[0]['id'];
	}

	public async updateProject(manager: EntityManager, projectId: number, updatedValues: object): Promise<void> {
		await manager
			.createQueryBuilder()
			.update(Project)
			.set(updatedValues)
			.where('id = :projectId', { projectId })
			.execute();
	}
}
