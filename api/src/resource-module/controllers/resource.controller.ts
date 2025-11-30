import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResourceService } from '../services/resource.service';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { ResourceDto } from '../dtos/input/resource.dto';
import { ResourceAttributeDto } from '../dtos/resource-attribute.dto';
import { ResourceDetailDto } from '../dtos/resource-detail.dto';
import { ResourceNotFoundError } from '../../error-module/errors/resources/resource-not-found.error';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';

@ApiTags('Resource')
@Controller('/resource')
export class ResourceController {
	constructor(private readonly resourceService: ResourceService) {}

	@Get('/')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get resources',
		description:
			'Get all resources present in the system. Pagination is not needed, because there is not that many resources. Optionally filter by projectId to exclude OpenStack resources that are not available for the project.'
	})
	@ApiQuery({
		name: 'projectId',
		required: false,
		type: Number,
		description: 'Optional project ID to filter resources based on project restrictions (e.g., exclude OpenStack for personal projects or projects with active OpenStack allocation)'
	})
	@ApiOkResponse({
		description: 'Resources in the system.',
		type: ResourceDto
	})
	async getResources(@Query('projectId') projectId?: number) {
		return this.resourceService.getResources(projectId);
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
	async getResource(@Param('id') id: number, @RequestUser() user: UserDto) {
		return this.resourceService.getResource(id, user.role === 'user');
	}
}
