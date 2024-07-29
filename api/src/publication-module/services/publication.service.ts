import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Publication } from 'resource-manager-database';
import { PublicationInputDto } from '../dto/input/publication-input.dto';
import { ProjectPermissionService } from '../../project-module/services/project-permission.service';
import { ProjectPermissionEnum } from '../../project-module/enums/project-permission.enum';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { ProjectModel } from '../../project-module/models/project.model';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { Sorting } from '../../config-module/decorators/get-sorting';
import { PublicationModel } from '../models/publication.model';

@Injectable()
export class PublicationService {
	constructor(
		private readonly projectPermissionService: ProjectPermissionService,
		private readonly dataSource: DataSource,
		private readonly projectModel: ProjectModel,
		private readonly publicationModel: PublicationModel
	) {}

	async getProjectPublications(projectId: number, userId: number, pagination: Pagination, sorting: Sorting | null) {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId);
		const project = await this.projectModel.getProject(projectId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) || !project) {
			throw new ProjectNotFoundApiException();
		}

		return this.publicationModel.getProjectPublications(projectId, pagination, sorting);
	}

	async addPublicationToProject(
		userId: number,
		projectId: number,
		publications: PublicationInputDto[]
	): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.EDIT_PUBLICATIONS
			);

			// add publications to project
			await manager
				.createQueryBuilder()
				.insert()
				.into(Publication)
				.values(
					publications.map((publication) => ({
						projectId,
						title: publication.title,
						author: publication.authors,
						year: publication.year,
						journal: publication.journal,
						source: publication.source,
						uniqueId:
							publication.source === 'doi' && publication.uniqueId ? publication.uniqueId : randomUUID()
					}))
				)
				.execute();
		});
	}
}
