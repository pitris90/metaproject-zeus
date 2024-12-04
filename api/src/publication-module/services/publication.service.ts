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
import { PublicationNotFoundApiException } from '../../error-module/errors/publications/publication-not-found.api-exception';

@Injectable()
export class PublicationService {
	constructor(
		private readonly projectPermissionService: ProjectPermissionService,
		private readonly dataSource: DataSource,
		private readonly projectModel: ProjectModel,
		private readonly publicationModel: PublicationModel
	) {}

	async getProjectPublications(
		projectId: number,
		userId: number,
		pagination: Pagination,
		sorting: Sorting | null,
		isStepUp: boolean
	) {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId, isStepUp);
		const project = await this.projectModel.getProject(projectId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_PROJECT) || !project) {
			throw new ProjectNotFoundApiException();
		}

		return this.publicationModel.getProjectPublications(projectId, pagination, sorting);
	}

	async deleteProjectPublication(publicationId: number, userId: number, isStepUp: boolean) {
		const publication = await this.publicationModel.findById(publicationId);

		// validation if publication exists and user has permissions to delete it
		if (!publication) {
			throw new PublicationNotFoundApiException();
		}

		const permissions = await this.projectPermissionService.getUserPermissions(
			publication.projectId,
			userId,
			isStepUp
		);

		if (!permissions.has(ProjectPermissionEnum.EDIT_PUBLICATIONS)) {
			throw new PublicationNotFoundApiException();
		}

		await this.dataSource
			.createQueryBuilder()
			.delete()
			.from(Publication)
			.where('id = :id', { id: publicationId })
			.execute();
	}

	async addPublicationToProject(
		userId: number,
		projectId: number,
		publications: PublicationInputDto[],
		isStepUp: boolean
	): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.EDIT_PUBLICATIONS,
				isStepUp
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
