import { Controller, Get } from '@nestjs/common';

import {
	OpenstackCatalogResponse,
	OpenstackTagsCatalogService
} from '../services/openstack-tags.service';

@Controller('openstack/catalog')
export class OpenstackTagsController {
	constructor(private readonly catalogService: OpenstackTagsCatalogService) {}

	@Get()
	getCatalog(): OpenstackCatalogResponse {
		return this.catalogService.getCatalog();
	}
}
