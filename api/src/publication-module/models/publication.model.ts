import { Injectable } from '@nestjs/common';
import { Publication } from 'resource-manager-database';
import { DataSource } from 'typeorm';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { Sorting } from '../../config-module/decorators/get-sorting';

@Injectable()
export class PublicationModel {
	constructor(private readonly dataSource: DataSource) {}

	async getProjectPublications(projectId: number, pagination: Pagination, sorting: Sorting | null) {
		const publicationsBuilder = this.dataSource
			.createQueryBuilder()
			.select('p')
			.from(Publication, 'p')
			.where('p.projectId = :projectId', { projectId })
			.offset(pagination.offset)
			.limit(pagination.limit);

		if (sorting) {
			switch (sorting.columnAccessor) {
				case 'year':
					publicationsBuilder.orderBy('p.year', sorting.direction);
					break;
				default:
					publicationsBuilder.orderBy('p.id', sorting.direction);
			}
		}

		return publicationsBuilder.getManyAndCount();
	}
}
