import { Controller, Get } from '@nestjs/common';

import { OpenstackCatalogResponse, OpenstackTagsCatalogService } from '../services/openstack-tags.service';
import { OpenstackConstraintsService } from '../services/openstack-constraints.service';

type ExtendedOpenstackCatalogResponse = OpenstackCatalogResponse & {
	domains: string[];
	quotaKeys: string[];
};

@Controller('openstack/catalog')
export class OpenstackTagsController {
	constructor(
		private readonly catalogService: OpenstackTagsCatalogService,
		private readonly constraints: OpenstackConstraintsService
	) {}

	@Get()
	getCatalog(): ExtendedOpenstackCatalogResponse {
		const catalog = this.catalogService.getCatalog();
		return {
			...catalog,
			domains: this.constraints.getAllowedDomains(),
			quotaKeys: this.constraints.getAllowedQuotaKeys()
		};
	}
}
