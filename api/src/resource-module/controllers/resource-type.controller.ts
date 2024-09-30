import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceTypeService } from '../services/resource-type.service';

@ApiTags('Resource Type')
@Controller('/resource-type')
export class ResourceTypeController {
	constructor(private readonly resourceTypeService: ResourceTypeService) {}

	@Get('/')
	async getResourceTypeList() {
		return this.resourceTypeService.getResourceTypes();
	}
}
