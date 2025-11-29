import { Controller, Get } from '@nestjs/common';

import { OpenstackCatalogResponse, OpenstackTagsCatalogService } from '../services/openstack-tags.service';
import { OpenstackConstraintsService } from '../services/openstack-constraints.service';
import { OpenstackTerraformParserService } from '../services/openstack-terraform-parser.service';

/**
 * Flavor entry exposed in the catalog API.
 * Only non-public flavors are included.
 */
export interface OpenstackFlavorCatalogEntry {
	name: string;
	ram: number;
	vcpus: number;
}

/**
 * Network entry exposed in the catalog API.
 * Only non-shared networks are included.
 */
export interface OpenstackNetworkCatalogEntry {
	name: string;
}

type ExtendedOpenstackCatalogResponse = OpenstackCatalogResponse & {
	domains: string[];
	quotaKeys: string[];
	flavors: OpenstackFlavorCatalogEntry[];
	networks: OpenstackNetworkCatalogEntry[];
};

@Controller('openstack/catalog')
export class OpenstackTagsController {
	constructor(
		private readonly catalogService: OpenstackTagsCatalogService,
		private readonly constraints: OpenstackConstraintsService,
		private readonly terraformParser: OpenstackTerraformParserService
	) {}

	@Get()
	getCatalog(): ExtendedOpenstackCatalogResponse {
		const catalog = this.catalogService.getCatalog();
		const assignableFlavors = this.terraformParser.getAssignableFlavors();
		const assignableNetworks = this.terraformParser.getAssignableNetworks();

		return {
			...catalog,
			domains: this.constraints.getAllowedDomains(),
			quotaKeys: this.constraints.getAllowedQuotaKeys(),
			flavors: assignableFlavors.map((f) => ({
				name: f.name,
				ram: f.ram,
				vcpus: f.vcpus
			})),
			networks: assignableNetworks.map((n) => ({
				name: n.name
			}))
		};
	}
}
