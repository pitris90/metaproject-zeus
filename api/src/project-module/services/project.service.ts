import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Project, ProjectStatus, User } from 'resource-manager-database';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectRequestExistsApiException } from '../../error-module/errors/projects/project-request-exists.api-exception';
import { ProjectModel } from '../models/project.model';
import { ProjectMapper } from './project.mapper';

@Injectable()
export class ProjectService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly projectMapper: ProjectMapper,
		private readonly projectModel: ProjectModel
	) {}

	async getUserProjects(piId: number, projectStatus: ProjectStatus | null): Promise<ProjectDto[]> {
		const projectBuilder = this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.where('pi.id = :piId', { piId });

		if (projectStatus) {
			projectBuilder.andWhere('project.status = :projectStatus', { projectStatus });
		}

		const projects = await projectBuilder.getMany();

		return projects.map((project) => this.projectMapper.toProjectDto(project));
	}

	async requestProject(requestProjectDto: RequestProjectDto, piId: number): Promise<ProjectDto> {
		return this.dataSource.transaction(async (manager) => {
			const userRepository = manager.getRepository(User);

			const user = await userRepository.findOneByOrFail({
				id: piId
			});

			try {
				const projectId = await this.projectModel.createProject(manager, requestProjectDto, user);
				const project = await manager.getRepository(Project).findOneOrFail({
					relations: ['pi'],
					where: {
						id: projectId
					}
				});

				return this.projectMapper.toProjectDto(project);
			} catch (e) {
				if (
					e instanceof QueryFailedError &&
					e.message.includes('duplicate key value violates unique constraint')
				) {
					throw new ProjectRequestExistsApiException();
				}

				throw e;
			}
		});
	}
}
