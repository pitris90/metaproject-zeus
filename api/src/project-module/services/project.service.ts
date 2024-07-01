import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Project, ProjectStatus, User } from 'resource-manager-database';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectRequestExistsApiException } from '../../error-module/errors/projects/project-request-exists.api-exception';
import { ProjectModel } from '../models/project.model';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectMapper } from '../mappers/project.mapper';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { ProjectPermissionService } from './project-permission.service';

@Injectable()
export class ProjectService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly projectMapper: ProjectMapper,
		private readonly projectModel: ProjectModel,
		private readonly projectPermissionService: ProjectPermissionService
	) {}

	async getUserProjects(
		userId: number,
		projectStatus: ProjectStatus | null,
		pagination: Pagination
	): Promise<[ProjectDto[], number]> {
		const [projects, count] = await this.projectModel.getUserProjects(userId, projectStatus, false, pagination);
		return [projects.map((project) => this.projectMapper.toProjectDto(project)), count];
	}

	async getProjectDetail(projectId: number, userId: number): Promise<ProjectDto> {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId);
		const project = await this.projectModel.getProject(projectId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) || !project) {
			throw new ProjectNotFoundApiException();
		}

		return this.projectMapper.toProjectDto(project);
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
