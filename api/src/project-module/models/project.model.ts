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
import { Brackets, DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { Sorting } from '../../config-module/decorators/get-sorting';
import { slugify } from '../../common/utils/slugify.util';

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

	public async getProjectByExternalId(externalProjectId: number): Promise<Project | null> {
		return this.dataSource.getRepository(Project).findOne({
			where: {
				perunId: externalProjectId
			}
		});
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

		// Generate projectSlug from title
		const projectSlug = slugify(requestProjectDto.title);

		const result = await manager
			.createQueryBuilder()
			.insert()
			.into(Project)
			.values({
				title: requestProjectDto.title,
				projectSlug: projectSlug,
				description: requestProjectDto.description,
				link: requestProjectDto.link,
				status,
				pi: user
			})
			.execute();

		return result.identifiers[0]['id'];
	}

	public async ensurePersonalProjectForUserId(userId: number): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const user = await manager.getRepository(User).findOne({
				where: {
					id: userId
				}
			});

			if (!user) {
				return;
			}

			await this.ensurePersonalProject(manager, user);
		});
	}

	public async ensurePersonalProject(manager: EntityManager, user: User): Promise<Project> {
		const projectRepository = manager.getRepository(Project);
		const existingPersonal = await projectRepository.findOne({
			relations: {
				pi: true
			},
			where: {
				piId: user.id,
				isPersonal: true
			}
		});

		if (existingPersonal) {
			await this.ensurePersonalProjectMetadata(manager, existingPersonal, user);
			return existingPersonal;
		}

		const title = this.buildPersonalProjectTitle(user);
		const description = this.buildPersonalProjectDescription(user);

		try {
			const newProject = projectRepository.create({
				title,
				description,
				status: ProjectStatus.ACTIVE,
				piId: user.id,
				isPersonal: true
			});

			const personalProject = await projectRepository.save(newProject);

			return await projectRepository.findOneOrFail({
				relations: {
					pi: true
				},
				where: {
					id: personalProject.id
				}
			});
		} catch (error) {
			if (
				error instanceof QueryFailedError &&
				error.message.includes('duplicate key value violates unique constraint')
			) {
				const personalProject = await projectRepository.findOne({
					relations: {
						pi: true
					},
					where: {
						piId: user.id,
						isPersonal: true
					}
				});

				if (personalProject) {
					await this.ensurePersonalProjectMetadata(manager, personalProject, user);
					return personalProject;
				}
			}

			throw error;
		}
	}

	private async ensurePersonalProjectMetadata(manager: EntityManager, project: Project, user: User): Promise<void> {
		const expectedTitle = this.buildPersonalProjectTitle(user);
		const expectedDescription = this.buildPersonalProjectDescription(user);

		if (project.title === expectedTitle && project.description === expectedDescription) {
			return;
		}

		await manager
			.createQueryBuilder()
			.update(Project)
			.set({
				title: expectedTitle,
				description: expectedDescription
			})
			.where('id = :projectId', { projectId: project.id })
			.execute();

		project.title = expectedTitle;
		project.description = expectedDescription;
	}

	private buildPersonalProjectTitle(user: User): string {
		const email = user.email ?? `user-${user.id}`;
		const source = user.source ?? 'unknown';
		return `Personal project ${email}:${source}`;
	}

	private buildPersonalProjectDescription(user: User): string {
		const identifier = user.name ?? user.email ?? user.username ?? `ID ${user.id}`;
		return `Personal project created automatically for ${identifier}.`;
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
			.where(
				'pu.userId = :subUserId AND pu.status = :subStatus AND pu.role IN (:...allowedRoles) AND pu.projectId = project.id'
			)
			.getQuery();

		const projectQuery = this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.where(
				new Brackets((qb) => {
					qb.where('pi.id = :piId', { piId: userId }).orWhere(`EXISTS (${existsInProjectQuery})`, {
						subUserId: userId,
						subStatus: ProjectUserStatus.ACTIVE,
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
