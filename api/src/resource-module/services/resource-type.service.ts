import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ResourceType } from 'resource-manager-database';
import { ResourceMapper } from '../mappers/resource.mapper';

@Injectable()
export class ResourceTypeService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly resourceMapper: ResourceMapper
	) {}

	async getResourceTypes() {
		const resourceTypes = await this.dataSource
			.createQueryBuilder()
			.select('rt')
			.from(ResourceType, 'rt')
			.leftJoin('rt.resources', 'r')
			.loadRelationCountAndMap('rt.resourcesCount', 'rt.resources')
			.orderBy('rt.id')
			.getMany();

		return resourceTypes.map((rt) => this.resourceMapper.toResourceTypeDto(rt, rt['resourcesCount'] > 0));
	}
}
