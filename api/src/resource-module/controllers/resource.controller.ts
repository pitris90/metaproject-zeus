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

	@Get('/:id')
	async getResource(@Param('id') id: number) {
		return this.resourceService.getResource(id);
	}
}
