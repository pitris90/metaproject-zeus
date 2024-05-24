import { Injectable } from '@nestjs/common';
import { Project, ProjectStatus, ProjectUserRole, User } from 'resource-manager-database';
import { DataSource, EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RequestProjectDto } from '../dtos/input/request-project.dto';

@Injectable()
export class ProjectModel {
	constructor(private readonly dataSource: DataSource) {}

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

	public async getUserProject(
		projectId: number,
		userId: number,
		projectStatus: ProjectStatus | null,
		requireManagerPosition: boolean
	): Promise<Project | null> {
		const projectBuilder = await this.getUserProjectBuilder(
			projectId,
			userId,
			projectStatus,
			requireManagerPosition
		);

		return projectBuilder.getOne();
	}

	public async getUserProjects(
		userId: number,
		projectStatus: ProjectStatus | null,
		requireManagerPosition: boolean
	): Promise<Project[]> {
		const projectBuilder = await this.getUserProjectBuilder(null, userId, projectStatus, requireManagerPosition);
		return projectBuilder.getMany();
	}

	public async updateProject(
		manager: EntityManager,
		projectId: number,
		updatedValues: QueryDeepPartialEntity<Project>
	): Promise<void> {
		await manager
			.createQueryBuilder()
			.update(Project)
			.set(updatedValues)
			.where('id = :projectId', { projectId })
			.execute();
	}

	private async getUserProjectBuilder(
		projectId: number | null,
		userId: number,
		projectStatus: ProjectStatus | null,
		requireManagerPosition: boolean
	) {
		const projectQuery = this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.leftJoinAndSelect('project.members', 'members')
			.where('(pi.id = :piId OR members.user = :userId)', { piId: userId, userId: userId });

		if (requireManagerPosition) {
			projectQuery.andWhere('pi.id = :userId OR members.role = :managerPosition', {
				userId,
				managerPosition: ProjectUserRole.MANAGER
			});
		}

		if (projectStatus) {
			projectQuery.andWhere('project.status = :projectStatus', { projectStatus });
		}

		if (projectId) {
			projectQuery.andWhere('project.id = :projectId', { projectId });
		}

		return projectQuery;
	}
}
