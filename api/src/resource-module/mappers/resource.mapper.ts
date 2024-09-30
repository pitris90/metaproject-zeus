import { Injectable } from '@nestjs/common';
import { ResourceType } from 'resource-manager-database';
import { ResourceTypeDto } from '../dtos/resource-type.dto';

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
}
