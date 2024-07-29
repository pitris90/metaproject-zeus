import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Publication } from 'resource-manager-database';
import { PublicationInputDto } from '../dto/input/publication-input.dto';
import { ProjectPermissionService } from '../../project-module/services/project-permission.service';
import { ProjectPermissionEnum } from '../../project-module/enums/project-permission.enum';

@Injectable()
export class PublicationService {
	constructor(
		private readonly projectPermissionService: ProjectPermissionService,
		private readonly dataSource: DataSource
	) {}

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
