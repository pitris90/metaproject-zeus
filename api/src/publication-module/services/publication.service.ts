import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Publication } from 'resource-manager-database';
import { PublicationInputDto } from '../dto/input/publication-input.dto';
import { AssignPublicationDto, CreateOwnedPublicationDto } from '../dto/input/publication-assign.dto';
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

	async getUserPublications(userId: number, pagination: Pagination, sorting: Sorting | null) {
		return this.publicationModel.getUserPublications(userId, pagination, sorting);
	}

	async createOwnedPublication(userId: number, input: CreateOwnedPublicationDto) {
		await this.dataSource
			.createQueryBuilder()
			.insert()
			.into(Publication)
			.values({
				ownerId: userId,
				title: input.title,
				author: input.authors,
				year: input.year,
				journal: input.journal,
				source: input.source,
				uniqueId: input.source === 'doi' && input.uniqueId ? input.uniqueId : randomUUID()
			} as any)
			.execute();
	}

	async assignOwnedPublication(userId: number, publicationId: number, dto: AssignPublicationDto, isStepUp: boolean) {
		const publication = await this.publicationModel.findOwnedByUser(publicationId, userId);
		if (!publication) {
			throw new PublicationNotFoundApiException();
		}

		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				dto.projectId,
				userId,
				ProjectPermissionEnum.EDIT_PUBLICATIONS,
				isStepUp
			);

			await manager
				.createQueryBuilder()
				.update(Publication)
				.set({ projectId: dto.projectId })
				.where('id = :id', { id: publicationId })
				.execute();
		});
	}

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

		// publication must belong to a project to be unassigned by project context
		if (publication.projectId == null) {
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

		// Unassign from project instead of deleting the record
		await this.dataSource
			.createQueryBuilder()
			.update(Publication)
			.set({ projectId: null as any })
			.where('id = :id', { id: publicationId })
			.execute();
	}

	async deleteOwnedPublication(publicationId: number, userId: number) {
		const publication = await this.publicationModel.findOwnedByUser(publicationId, userId);
		if (!publication) {
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

			// add or reuse publications for the project
			for (const publication of publications) {
				const uniqueId =
					publication.source === 'doi' && publication.uniqueId ? publication.uniqueId : randomUUID();
				// Try to reuse if same DOI exists for this owner
				const existing = publication.uniqueId
					? await this.publicationModel.findByOwnerAndUniqueId(userId, publication.uniqueId)
					: null;

				if (existing) {
					await manager
						.createQueryBuilder()
						.update(Publication)
						.set({ projectId })
						.where('id = :id', { id: existing.id })
						.execute();
				} else {
					await manager
						.createQueryBuilder()
						.insert()
						.into(Publication)
						.values({
							ownerId: userId,
							projectId,
							title: publication.title,
							author: publication.authors,
							year: publication.year,
							journal: publication.journal,
							source: publication.source,
							uniqueId
						} as any)
						.execute();
				}
			}
		});
	}
}
