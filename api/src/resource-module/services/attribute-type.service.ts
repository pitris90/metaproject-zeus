import { DataSource } from 'typeorm';
import { AttributeType } from 'resource-manager-database';
import { Injectable } from '@nestjs/common';
import { AttributeMapper } from '../mappers/attribute.mapper';

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
}
