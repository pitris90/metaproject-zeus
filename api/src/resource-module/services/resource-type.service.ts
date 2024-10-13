import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ResourceAttributeType, ResourceToAttributeType, ResourceType } from 'resource-manager-database';
import { ResourceMapper } from '../mappers/resource.mapper';
import { AttributeTypeInputDto } from '../dtos/input/attribute-type.input.dto';
import { ResourceAttributeConnectedError } from '../../error-module/errors/resources/resource-attribute-connected.error';
import { ResourceNotFoundError } from '../../error-module/errors/resources/resource-not-found.error';
import { InvalidResourceOperationError } from '../../error-module/errors/resources/invalid-resource-operation.error';

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

	async createAttributeType(attributeTypeInput: AttributeTypeInputDto) {
		await this.dataSource
			.createQueryBuilder()
			.insert()
			.into(ResourceAttributeType)
			.values({
				name: attributeTypeInput.name,
				attributeTypeId: attributeTypeInput.attributeTypeId,
				isRequired: attributeTypeInput.isRequired,
				isPublic: attributeTypeInput.isPublic
			})
			.execute();
	}

	async deleteAttributeType(id: number) {
		const resourceType = await this.dataSource
			.createQueryBuilder()
			.select('rat')
			.from(ResourceAttributeType, 'rat')
			.where('rat.id = :id', { id })
			.getOne();

		if (!resourceType) {
			throw new ResourceNotFoundError();
		}

		if (resourceType.name.startsWith('quantity_')) {
			throw new InvalidResourceOperationError();
		}

		const hasResources = await this.dataSource
			.createQueryBuilder()
			.select()
			.from(ResourceToAttributeType, 'rtat')
			.where('rtat.resourceAttributeTypeId = :id', { id })
			.getExists();

		if (hasResources) {
			throw new ResourceAttributeConnectedError();
		}

		await this.dataSource
			.createQueryBuilder()
			.delete()
			.from(ResourceAttributeType)
			.where('id = :id', { id })
			.execute();
	}
}
