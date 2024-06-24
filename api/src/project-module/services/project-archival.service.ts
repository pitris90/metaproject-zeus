import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProjectStatus } from 'resource-manager-database';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectModel } from '../models/project.model';
import { ProjectMapper } from '../mappers/project.mapper';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { InvalidPermissionException } from '../exceptions/invalid-permission.exception';
import { ProjectInvalidStatusApiException } from '../../error-module/errors/projects/project-invalid-status.api-exception';
import { ProjectLockService } from './project-lock.service';
import { ProjectPermissionService } from './project-permission.service';

@Injectable()
export class ProjectArchivalService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly projectModel: ProjectModel,
		private readonly projectMapper: ProjectMapper,
		private readonly projectLockService: ProjectLockService,
		private readonly projectPermissionService: ProjectPermissionService
	) {}

	public async archiveProject(userId: number, projectId: number): Promise<ProjectDto> {
		return this.dataSource.transaction(async (manager) => {
			// lock project before manipulation
			await this.projectLockService.lockProject(manager, projectId);

			// check if user can archive project
			try {
				await this.projectPermissionService.validateUserPermissions(
					manager,
					projectId,
					userId,
					ProjectPermissionEnum.EDIT_PROJECT
				);
			} catch (error) {
				if (error instanceof InvalidPermissionException) {
					throw new ProjectNotFoundApiException();
				}

				throw error;
			}

			const project = await this.projectModel.getProject(projectId);

			if (project === null) {
				throw new ProjectNotFoundApiException();
			}

			if (project.status !== ProjectStatus.ACTIVE) {
				throw new ProjectInvalidStatusApiException();
			}

			// update project status
			await this.projectModel.updateProject(manager, projectId, { status: ProjectStatus.INACTIVE });

			// TODO create record about project archival

			project.status = ProjectStatus.INACTIVE;
			return this.projectMapper.toProjectDto(project);
		});
	}
}
