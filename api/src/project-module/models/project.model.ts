import { Injectable } from '@nestjs/common';
import {
	Project,
	ProjectStatus,
	ProjectUser,
	ProjectUserRole,
	ProjectUserStatus,
	User
} from 'resource-manager-database';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RequestProjectDto } from '../dtos/input/request-project.dto';

@Injectable()
export class ProjectModel {
	constructor(private readonly dataSource: DataSource) {}

	public async getProject(projectId: number): Promise<Project | null> {
		return this.dataSource.getRepository(Project).findOne({
			relations: {
				pi: true
			},
			where: {
				id: projectId
			}
		});
	}

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
		const existsInProjectQuery = this.dataSource
			.createQueryBuilder()
			.select('1')
			.from(ProjectUser, 'pu')
			.where(
				'pu.projectId = :subProjectId AND pu.userId = :subUserId AND pu.status != :subStatus AND pu.role IN (:...allowedRoles)'
			)
			.getQuery();

		const projectQuery = this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.where(
				new Brackets((qb) => {
					qb.where('pi.id = :piId', { piId: userId }).orWhere(`EXISTS (${existsInProjectQuery})`, {
						subProjectId: projectId,
						subUserId: userId,
						subStatus: ProjectUserStatus.DENIED,
						allowedRoles: requireManagerPosition
							? [ProjectUserRole.MANAGER]
							: [ProjectUserRole.MANAGER, ProjectUserRole.USER]
					});
				})
			);

		if (projectStatus) {
			projectQuery.andWhere('project.status = :projectStatus', { projectStatus });
		}

		if (projectId) {
			projectQuery.andWhere('project.id = :projectId', { projectId });
		}

		return projectQuery;
	}
}
