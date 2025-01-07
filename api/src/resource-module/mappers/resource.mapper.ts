import { Injectable, Logger } from '@nestjs/common';
import { Resource, ResourceAttributeType, ResourceToAttributeType, ResourceType } from 'resource-manager-database';
import { ResourceTypeDto } from '../dtos/resource-type.dto';
import { ResourceDto } from '../dtos/input/resource.dto';
import { ResourceDetailDto } from '../dtos/resource-detail.dto';
import { ResourceAttributeDto } from '../dtos/resource-attribute.dto';

@Injectable()
export class ResourceMapper {
	private readonly logger = new Logger(ResourceMapper.name);

	toResourceTypeDto(resourceType: ResourceType, hasResources: boolean): ResourceTypeDto {
		return {
			id: resourceType.id,
			name: resourceType.name,
			description: resourceType.description,
			hasResources
		};
	}

	toResourceDto(resource: Resource): ResourceDto {
		return {
			id: resource.id,
			name: resource.name,
			isAvailable: resource.isAvailable,
			resourceType: {
				id: resource.resourceType.id,
				name: resource.resourceType.name
			},
			parentResourceId: resource.parentResourceId
		};
	}

	toResourceDetailDto(
		resource: Resource,
		attributes: ResourceToAttributeType[],
		requiredAttributes: ResourceAttributeType[]
	): ResourceDetailDto {
		const originalKeys = [
			...new Set([...requiredAttributes.map((a) => a.name), attributes.find((a) => a.resourceAttributeType.name)])
		];
		const joinedAttributes = originalKeys.flatMap((key) => {
			const attribute: ResourceAttributeType | undefined =
				attributes.find((a) => a.resourceAttributeType.name === key)?.resourceAttributeType ??
				requiredAttributes.find((a) => a.name === key);

			if (!attribute) {
				this.logger.log(`Attribute ${key} not found in resource ${resource.id}`);
				return [];
			}

			return [
				{
					key: attribute.name,
					value: attributes.find((a) => a.resourceAttributeType.name === key)?.value ?? '',
					isPublic: attribute.isPublic,
					isRequired: attribute.isRequired,
					type: attribute.attributeType.name
				}
			];
		});

		return {
			id: resource.id,
			name: resource.name,
			description: resource.description,
			isAvailable: resource.isAvailable,
			resourceType: {
				id: resource.resourceType.id,
				name: resource.resourceType.name
			},
			parentResource: resource.parentResource && {
				id: resource.parentResource.id,
				name: resource.parentResource.name
			},
			attributes: joinedAttributes
		};
	}

	toResourceAttributeDto(resourceAttribute: ResourceAttributeType): ResourceAttributeDto {
		return {
			id: resourceAttribute.id,
			name: resourceAttribute.name,
			isPublic: resourceAttribute.isPublic,
			isRequired: resourceAttribute.isRequired,
			attributeType: {
				id: resourceAttribute.attributeType.id,
				name: resourceAttribute.attributeType.name
			},
			hasResources: resourceAttribute.resourceToResourceAttributes.length > 0
		};
	}
}
