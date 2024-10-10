import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttributeTypeService } from '../services/attribute-type.service';

@ApiTags('Attribute')
@Controller('/attribute-type')
export class AttributeTypeController {
	constructor(private readonly attributeTypeService: AttributeTypeService) {}

	@Get('/')
	async getAttributeTypes() {
		return this.attributeTypeService.getAttributeTypes();
	}
}
