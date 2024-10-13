import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceTypeService } from '../services/resource-type.service';
import { AttributeTypeInputDto } from '../dtos/input/attribute-type.input.dto';
import { RolesCheck } from '../../permission-module/decorators/roles.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('Resource Type')
@RolesCheck([RoleEnum.ADMIN])
@Controller('/resource-type')
export class ResourceTypeController {
	constructor(private readonly resourceTypeService: ResourceTypeService) {}

	@Get('/')
	async getResourceTypeList() {
		return this.resourceTypeService.getResourceTypes();
	}

	@Post('/')
	@HttpCode(201)
	async createAttributeType(@Body() attributeTypeInput: AttributeTypeInputDto) {
		return this.resourceTypeService.createAttributeType(attributeTypeInput);
	}

	@Delete('/:id')
	@HttpCode(204)
	async deleteAttributeType(@Param('id') id: number) {
		await this.resourceTypeService.deleteAttributeType(id);
	}
}
