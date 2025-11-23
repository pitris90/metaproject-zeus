import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProjectStatus, File, ProjectArchival } from 'resource-manager-database';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Express } from 'express';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectModel } from '../models/project.model';
import { ProjectMapper } from '../mappers/project.mapper';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { InvalidPermissionException } from '../exceptions/invalid-permission.exception';
import { ProjectInvalidStatusApiException } from '../../error-module/errors/projects/project-invalid-status.api-exception';
import { ProjectArchiveDto } from '../dtos/input/project-archive.dto';
import { ProjectDefaultImmutableApiException } from '../../error-module/errors/projects/project-default-immutable.api-exception';
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

	public async archiveProject(
		userId: number,
		projectId: number,
		projectArchiveDto: ProjectArchiveDto,
		file: Express.Multer.File,
		isStepUp: boolean
	): Promise<ProjectDto> {
		return this.dataSource.transaction(async (manager) => {
			// lock project before manipulation
			await this.projectLockService.lockProject(manager, projectId);

			// check if user can archive project
			try {
				await this.projectPermissionService.validateUserPermissions(
					manager,
					projectId,
					userId,
					ProjectPermissionEnum.EDIT_PROJECT,
					isStepUp
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

			if (project.isPersonal) {
				throw new ProjectDefaultImmutableApiException();
			}

			if (project.status !== ProjectStatus.ACTIVE) {
				throw new ProjectInvalidStatusApiException();
			}

			// update project status
			await this.projectModel.updateProject(manager, projectId, { status: ProjectStatus.ARCHIVED });

			// create file
			const createdFile = await manager
				.createQueryBuilder()
				.insert()
				.into(File)
				.values({ originalName: file.originalname, mime: file.mimetype, path: file.path, size: file.size })
				.returning('id')
				.execute();

			// create record about project archival
			await manager
				.createQueryBuilder()
				.insert()
				.into(ProjectArchival)
				.values({
					project: project,
					reportFileId: createdFile.raw[0]['id'],
					description: projectArchiveDto.message
				})
				.execute();

			project.status = ProjectStatus.ARCHIVED;
			return this.projectMapper.toProjectDto(project);
		});
	}
}
