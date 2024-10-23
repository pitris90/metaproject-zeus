import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { ResourceInputDto } from '../dtos/input/resource-input.dto';
import { ResourceService } from '../services/resource.service';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { ResourceNotFoundError } from '../../error-module/errors/resources/resource-not-found.error';

@MinRoleCheck(RoleEnum.ADMIN)
@ApiTags('Resource')
@Controller('/resource')
export class ResourceAdminController {
	constructor(private readonly resourceService: ResourceService) {}

	@Post('/')
	@HttpCode(201)
	@ApiOperation({
		summary: 'Create resource',
		description: 'Create resource with its attributes.'
	})
	@ApiCreatedResponse({
		description: 'The resource was successfully created.'
	})
	async createResource(@Body() resourceInputDto: ResourceInputDto) {
		await this.resourceService.createResource(resourceInputDto);
	}

	@Post('/:id')
	@HttpCode(204)
	@ApiOperation({
		summary: 'Update resource',
		description: 'Update resource with current ID.'
	})
	@ApiOkResponse({
		description: 'The resource was successfully updated.'
	})
	@ApiNotFoundResponse({
		description: 'Resource not found',
		type: ResourceNotFoundError
	})
	async updateResource(@Param('id') id: number, @Body() resourceInputDto: ResourceInputDto) {
		await this.resourceService.updateResource(id, resourceInputDto);
	}
}
