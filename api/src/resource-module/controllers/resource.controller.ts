import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResourceService } from '../services/resource.service';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { ResourceDto } from '../dtos/input/resource.dto';
import { ResourceAttributeDto } from '../dtos/resource-attribute.dto';
import { ResourceDetailDto } from '../dtos/resource-detail.dto';
import { ResourceNotFoundError } from '../../error-module/errors/resources/resource-not-found.error';

@ApiTags('Resource')
@Controller('/resource')
export class ResourceController {
	constructor(private readonly resourceService: ResourceService) {}

	@Get('/')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get resources',
		description:
			'Get all resources present in the system. Pagination is not needed, because there is not that many resources.'
	})
	@ApiOkResponse({
		description: 'Resources in the system.',
		type: ResourceDto
	})
	async getResources() {
		return this.resourceService.getResources();
	}

	@Get('/attributes')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get resource attributes',
		description: 'Get all attributes which can be connected to resource.'
	})
	@ApiOkResponse({
		description: 'Resource attributes.',
		type: [ResourceAttributeDto]
	})
	async getResourceAttributes() {
		return this.resourceService.getResourceAttributes();
	}

	@Get('/:id')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get resource detail',
		description: 'Get resource detail.'
	})
	@ApiOkResponse({
		description: 'Detail and attributes of the resource.',
		type: ResourceDetailDto
	})
	@ApiNotFoundResponse({
		description: 'Resource does not exist.',
		type: ResourceNotFoundError
	})
	async getResource(@Param('id') id: number) {
		// TODO add validation for admin or director, get only available detail for public attributes
		return this.resourceService.getResource(id);
	}
}
