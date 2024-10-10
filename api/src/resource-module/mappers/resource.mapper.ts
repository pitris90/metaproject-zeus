import { Injectable } from '@nestjs/common';
import { Resource, ResourceAttributeType, ResourceType } from 'resource-manager-database';
import { ResourceTypeDto } from '../dtos/resource-type.dto';
import { ResourceDto } from '../dtos/input/resource.dto';
import { ResourceDetailDto } from '../dtos/resource-detail.dto';
import { ResourceAttributeDto } from '../dtos/resource-attribute.dto';

@Injectable()
export class ResourceMapper {
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

	toResourceDetailDto(resource: Resource): ResourceDetailDto {
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
			attributes: resource.resourceToResourceAttributes.map((a) => ({
				key: a.resourceAttributeType.name,
				value: a.value,
				isPublic: a.resourceAttributeType.isPublic,
				type: a.resourceAttributeType.attributeType.name
			}))
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
