import { Controller, Get } from '@nestjs/common';
import { ResourceTypeService } from '../services/resource-type.service';

@Controller('/resource-type')
export class ResourceTypeController {
	constructor(private readonly resourceTypeService: ResourceTypeService) {}

	@Get('/')
	async getResourceTypeList() {
		return this.resourceTypeService.getResourceTypes();
	}
}
