import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Project, ProjectStatus, User } from 'resource-manager-database';
import { RequestProjectDto } from '../dtos/input/request-project.dto';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectExistsApiException } from '../../error-module/errors/projects/project-exists.api-exception';
import { ProjectModel } from '../models/project.model';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectMapper } from '../mappers/project.mapper';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { Sorting } from '../../config-module/decorators/get-sorting';
import { ProjectDetailDto } from '../dtos/project-detail.dto';
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
		pagination: Pagination,
		sorting: Sorting
	): Promise<[ProjectDto[], number]> {
		const [projects, count] = await this.projectModel.getUserProjects(
			userId,
			projectStatus,
			false,
			pagination,
			sorting
		);
		return [projects.map((project) => this.projectMapper.toProjectDto(project)), count];
	}

	async getProjects(
		projectStatus: ProjectStatus | null,
		pagination: Pagination,
		sorting: Sorting
	): Promise<[ProjectDto[], number]> {
		const [projects, count] = await this.projectModel.getProjects(projectStatus, pagination, sorting);
		return [projects.map((project) => this.projectMapper.toProjectDto(project)), count];
	}

	async getProjectDetail(projectId: number, userId: number): Promise<ProjectDetailDto> {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId);
		const project = await this.projectModel.getProject(projectId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) || !project) {
			throw new ProjectNotFoundApiException();
		}

		const archivalInfo = userPermissions.has(ProjectPermissionEnum.VIEW_ADVANCED_DETAILS)
			? await this.projectModel.getArchivalInfo(projectId)
			: null;

		const rejectedComments = userPermissions.has(ProjectPermissionEnum.VIEW_ADVANCED_DETAILS)
			? await this.projectModel.getRejectedComments(projectId)
			: null;

		return this.projectMapper.toProjectDetailDto(project, userPermissions, archivalInfo, rejectedComments);
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
					throw new ProjectExistsApiException();
				}

				throw e;
			}
		});
	}

	async requestProjectAgain(projectId: number, userId: number, requestProjectDto: RequestProjectDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.EDIT_PROJECT
			);

			const project = await manager.getRepository(Project).findOne({
				where: {
					id: projectId
				}
			});

			if (!project || project.status !== ProjectStatus.REJECTED) {
				throw new ProjectNotFoundApiException();
			}

			try {
				await this.projectModel.updateProject(manager, projectId, {
					title: requestProjectDto.title,
					link: requestProjectDto.link,
					description: requestProjectDto.description,
					status: ProjectStatus.NEW
				});
			} catch (e) {
				if (
					e instanceof QueryFailedError &&
					e.message.includes('duplicate key value violates unique constraint')
				) {
					throw new ProjectExistsApiException();
				}

				throw e;
			}
		});
	}
}
