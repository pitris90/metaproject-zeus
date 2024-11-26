import { Injectable } from '@nestjs/common';
import {
	ApprovalStatus,
	Project,
	ProjectApproval,
	ProjectArchival,
	ProjectStatus,
	ProjectUser,
	ProjectUserRole,
	ProjectUserStatus,
	User
} from 'resource-manager-database';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { Sorting } from '../../config-module/decorators/get-sorting';

@Injectable()
export class ProjectModel {
	constructor(private readonly dataSource: DataSource) {}

	public async getProject(projectId: number, forUpdate: boolean = false): Promise<Project | null> {
		const projectBuilder = this.dataSource
			.getRepository(Project)
			.createQueryBuilder('project')
			.innerJoinAndSelect('project.pi', 'pi');

		if (forUpdate) {
			projectBuilder.useTransaction(true).setLock('pessimistic_write');
		}

		return projectBuilder.where('project.id = :projectId', { projectId }).getOne();
	}

	public async getArchivalInfo(projectId: number): Promise<ProjectArchival | null> {
		return this.dataSource.getRepository(ProjectArchival).findOne({
			where: {
				projectId: projectId
			},
			relations: {
				reportFile: true
			}
		});
	}

	public async getRejectedComments(projectId: number): Promise<ProjectApproval[]> {
		return this.dataSource
			.createQueryBuilder(ProjectApproval, 'pa')
			.innerJoinAndSelect('pa.reviewer', 'r')
			.where('pa.projectId = :projectId', { projectId })
			.andWhere('pa.status = :status', { status: ApprovalStatus.REJECTED })
			.orderBy('pa.time.createdAt', 'DESC')
			.getMany();
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
				link: requestProjectDto.link,
				status,
				pi: user
			})
			.execute();

		return result.identifiers[0]['id'];
	}

	public async getUserProjects(
		userId: number,
		projectStatus: ProjectStatus | null,
		requireManagerPosition: boolean,
		pagination: Pagination,
		sorting: Sorting
	): Promise<[Project[], number]> {
		const existsInProjectQuery = this.dataSource
			.createQueryBuilder()
			.select('1')
			.from(ProjectUser, 'pu')
			.where('pu.userId = :subUserId AND pu.status != :subStatus AND pu.role IN (:...allowedRoles)')
			.getQuery();

		const projectQuery = this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.where(
				new Brackets((qb) => {
					// TODO add project ID to exists query
					qb.where('pi.id = :piId', { piId: userId }).orWhere(`EXISTS (${existsInProjectQuery})`, {
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

		switch (sorting.columnAccessor) {
			case 'title':
				projectQuery.orderBy('project.title', sorting.direction);
				break;
			case 'id':
				projectQuery.orderBy('project.id', sorting.direction);
				break;
			default:
				projectQuery.orderBy('project.createdAt', sorting.direction);
				break;
		}

		projectQuery.limit(pagination.limit).offset(pagination.offset);

		return projectQuery.getManyAndCount();
	}

	public async getProjects(
		status: ProjectStatus | null,
		pagination: Pagination,
		sorting: Sorting
	): Promise<[Project[], number]> {
		const projectQuery = this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.offset(pagination.offset)
			.limit(pagination.limit);

		if (status) {
			projectQuery.where('project.status = :status', { status });
		}

		switch (sorting.columnAccessor) {
			case 'title':
				projectQuery.orderBy('project.title', sorting.direction);
				break;
			case 'id':
				projectQuery.orderBy('project.id', sorting.direction);
				break;
			default:
				projectQuery.orderBy('project.createdAt', sorting.direction);
				break;
		}

		return projectQuery.getManyAndCount();
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
}
