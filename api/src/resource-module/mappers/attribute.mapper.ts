import { Injectable } from '@nestjs/common';
import { AttributeType } from 'resource-manager-database';
import { AttributeTypeDto } from '../dtos/attribute-type.dto';

@Injectable()
export class AttributeMapper {
	toAttributeTypeDto(attributeType: AttributeType): AttributeTypeDto {
		return {
			id: attributeType.id,
			name: attributeType.name
		};
	}
}
