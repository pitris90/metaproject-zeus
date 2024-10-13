import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceTypeService } from '../services/resource-type.service';
import { AttributeTypeInputDto } from '../dtos/input/attribute-type.input.dto';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';

@ApiTags('Resource Type')
@Controller('/resource-type')
export class ResourceTypeController {
	constructor(private readonly resourceTypeService: ResourceTypeService) {}

	@Get('/')
	@MinRoleCheck(RoleEnum.DIRECTOR)
	async getResourceTypeList() {
		return this.resourceTypeService.getResourceTypes();
	}

	@Post('/')
	@HttpCode(201)
	@MinRoleCheck(RoleEnum.ADMIN)
	async createAttributeType(@Body() attributeTypeInput: AttributeTypeInputDto) {
		return this.resourceTypeService.createAttributeType(attributeTypeInput);
	}

	@Delete('/:id')
	@HttpCode(204)
	@MinRoleCheck(RoleEnum.ADMIN)
	async deleteAttributeType(@Param('id') id: number) {
		await this.resourceTypeService.deleteAttributeType(id);
	}
}
