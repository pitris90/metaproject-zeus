import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Resource, ResourceAttributeType, ResourceToAttributeType } from 'resource-manager-database';
import { ResourceInputDto } from '../dtos/input/resource-input.dto';
import { ResourceMapper } from '../mappers/resource.mapper';
import { ResourceNotFoundError } from '../../error-module/errors/resources/resource-not-found.error';

@Injectable()
export class ResourceService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly resourceMapper: ResourceMapper
	) {}

	async getResource(id: number, onlyPublic: boolean) {
		const resourceQueryBuilder = this.dataSource
			.createQueryBuilder()
			.select('r')
			.from(Resource, 'r')
			.where('r.id = :id', { id })
			.innerJoinAndSelect('r.resourceType', 'resourceType')
			.leftJoinAndSelect('r.parentResource', 'parentResource');

		if (onlyPublic) {
			resourceQueryBuilder.andWhere('r.isAvailable = :isAvailable', { isAvailable: true });
		}

		const resource = await resourceQueryBuilder.getOne();

		if (!resource) {
			throw new ResourceNotFoundError();
		}

		const attributesQueryBuilder = this.dataSource
			.createQueryBuilder()
			.select('rta')
			.from(ResourceToAttributeType, 'rta')
			.where('rta.resourceId = :id', { id })
			.innerJoinAndSelect('rta.resourceAttributeType', 'resourceAttributeType')
			.innerJoinAndSelect('resourceAttributeType.attributeType', 'attributeType');

		if (onlyPublic) {
			attributesQueryBuilder.andWhere('resourceAttributeType.isPublic = :isPublic', { isPublic: true });
		}

		const attributes = await attributesQueryBuilder.getMany();

		return this.resourceMapper.toResourceDetailDto(resource, attributes);
	}

	async getResourceAttributes() {
		const resourceAttributes = await this.dataSource.getRepository(ResourceAttributeType).find({
			relations: ['attributeType', 'resourceToResourceAttributes']
		});
		return resourceAttributes.map((resourceAttribute) =>
			this.resourceMapper.toResourceAttributeDto(resourceAttribute)
		);
	}

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

			const attributeTypes = await manager
				.createQueryBuilder()
				.select('rat')
				.from(ResourceAttributeType, 'rat')
				.where('name IN (:...names)', { names: resourceInputDto.attributes.map((a) => a.key) })
				.getMany();

			const attributeValues = attributeTypes.flatMap((at) => {
				const value = resourceInputDto.attributes.find((a) => a.key === at['name'])?.value;

				if (!value) {
					return [];
				}

				return {
					resourceId,
					resourceAttributeTypeId: at['id'],
					value
				};
			});

			await manager.createQueryBuilder().insert().into(ResourceToAttributeType).values(attributeValues).execute();
		});
	}

	async updateResource(id: number, resourceInputDto: ResourceInputDto) {
		await this.dataSource.transaction(async (manager) => {
			const resource = await manager.getRepository(Resource).findOne({
				where: { id }
			});

			if (!resource) {
				throw new ResourceNotFoundError();
			}

			await manager
				.createQueryBuilder()
				.update(Resource)
				.set({
					name: resourceInputDto.name,
					description: resourceInputDto.description,
					isAvailable: resourceInputDto.isAvailable,
					resourceTypeId: resourceInputDto.resourceTypeId,
					parentResourceId: resourceInputDto.parentResourceId
				})
				.where('id = :id', { id })
				.execute();

			const attributeTypes = await manager
				.createQueryBuilder()
				.select('rat')
				.from(ResourceAttributeType, 'rat')
				.where('name IN (:...names)', { names: resourceInputDto.attributes.map((a) => a.key) })
				.getMany();

			const attributeValues = attributeTypes.flatMap((at) => {
				const value = resourceInputDto.attributes.find((a) => a.key === at['name'])?.value;

				if (!value) {
					return [];
				}

				return {
					resourceId: id,
					resourceAttributeTypeId: at['id'],
					value
				};
			});

			await manager
				.createQueryBuilder()
				.delete()
				.from(ResourceToAttributeType)
				.where('resourceId = :id', { id })
				.execute();

			await manager.createQueryBuilder().insert().into(ResourceToAttributeType).values(attributeValues).execute();
		});
	}
}
