import { Injectable } from '@nestjs/common';
import { Resource, ResourceType } from 'resource-manager-database';
import { ResourceTypeDto } from '../dtos/resource-type.dto';
import { ResourceDto } from '../dtos/input/resource.dto';

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
}
