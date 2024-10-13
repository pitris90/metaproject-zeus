import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceService } from '../services/resource.service';

@ApiTags('Resource')
@Controller('/resource')
export class ResourceController {
	constructor(private readonly resourceService: ResourceService) {}

	@Get('/')
	async getResources() {
		return this.resourceService.getResources();
	}

	@Get('/attributes')
	async getResourceAttributes() {
		return this.resourceService.getResourceAttributes();
	}

	@Get('/:id')
	async getResource(@Param('id') id: number) {
		// TODO add validation for admin, get only available detail for public attributes
		return this.resourceService.getResource(id);
	}
}
