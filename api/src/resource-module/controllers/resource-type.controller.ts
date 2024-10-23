import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger';
import { ResourceTypeService } from '../services/resource-type.service';
import { AttributeTypeInputDto } from '../dtos/input/attribute-type.input.dto';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { ResourceTypeDto } from '../dtos/resource-type.dto';
import { AttributeTypeDto } from '../dtos/attribute-type.dto';
import { ResourceNotFoundError } from '../../error-module/errors/resources/resource-not-found.error';
import { InvalidResourceOperationError } from '../../error-module/errors/resources/invalid-resource-operation.error';

@ApiTags('Resource')
@Controller('/resource-type')
export class ResourceTypeController {
	constructor(private readonly resourceTypeService: ResourceTypeService) {}

	@Get('/')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get resource types',
		description: 'Get all resource types.'
	})
	@ApiOkResponse({
		description: 'Resource types in the system.',
		type: [ResourceTypeDto]
	})
	async getResourceTypeList() {
		return this.resourceTypeService.getResourceTypes();
	}

	@Post('/')
	@HttpCode(201)
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Create attribute type',
		description: 'Create a new attribute type.'
	})
	@ApiCreatedResponse({
		description: 'The attribute type was successfully created.'
	})
	async createAttributeType(@Body() attributeTypeInput: AttributeTypeInputDto) {
		return this.resourceTypeService.createAttributeType(attributeTypeInput);
	}

	@Delete('/:id')
	@HttpCode(204)
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Delete attribute type',
		description: 'Get defined attribute types.'
	})
	@ApiOkResponse({
		description: 'Attribute types in the system.',
		type: AttributeTypeDto
	})
	@ApiNotFoundResponse({
		description: 'Resource type with given ID not found.',
		type: ResourceNotFoundError
	})
	@ApiForbiddenResponse({
		description: 'Resource name cannot start with "quantity_"',
		type: InvalidResourceOperationError
	})
	async deleteAttributeType(@Param('id') id: number) {
		await this.resourceTypeService.deleteAttributeType(id);
	}
}
