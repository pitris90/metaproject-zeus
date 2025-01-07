import { DataSource } from 'typeorm';
import { AttributeType, ResourceAttributeType } from 'resource-manager-database';
import { Injectable } from '@nestjs/common';
import { AttributeMapper } from '../mappers/attribute.mapper';
import { AttributeDto } from '../dtos/attribute.dto';

@Injectable()
export class AttributeTypeService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly attributeMapper: AttributeMapper
	) {}

	async getAttributeTypes() {
		const attributes = await this.dataSource.getRepository(AttributeType).find();
		return attributes.map((attribute) => this.attributeMapper.toAttributeTypeDto(attribute));
	}

	async hasRequiredAttributes(attributesToChange: AttributeDto[]) {
		const requiredResourceAttributes = await this.dataSource.getRepository(ResourceAttributeType).find({
			where: {
				isRequired: true
			}
		});

		for (const requiredAttribute of requiredResourceAttributes) {
			if (!attributesToChange.find((a) => a.key === requiredAttribute.attributeType.name)) {
				return false;
			}
		}

		return true;
	}
}
