import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Resource, ResourceToAttributeType } from 'resource-manager-database';
import { ResourceInputDto } from '../dtos/input/resource-input.dto';
import { ResourceMapper } from '../mappers/resource.mapper';

@Injectable()
export class ResourceService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly resourceMapper: ResourceMapper
	) {}

	async getResources() {
		const resources = await this.dataSource.getRepository(Resource).find({
			relations: ['resourceType']
		});

		return resources.map((resource) => this.resourceMapper.toResourceDto(resource));
	}

	async createResource(resourceInputDto: ResourceInputDto) {
		await this.dataSource.transaction(async (manager) => {
			const result = await manager
				.createQueryBuilder()
				.insert()
				.into(Resource)
				.values({
					name: resourceInputDto.name,
					description: resourceInputDto.description,
					isAvailable: resourceInputDto.isAvailable,
					resourceTypeId: resourceInputDto.resourceTypeId,
					parentResourceId: resourceInputDto.parentResourceId
				})
				.execute();

			const resourceId = result.identifiers[0]['id'];

			const attributeValues = Object.values(resourceInputDto.attributes).map((attribute) => {
				return {
					resourceId,
					attributeTypeId: attribute.key,
					value: attribute.value
				};
			});

			await manager.createQueryBuilder().insert().into(ResourceToAttributeType).values(attributeValues).execute();
		});
	}
}
