import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenstackTerraformParserService } from './openstack-terraform-parser.service';

interface ConstraintConfig {
	domains: Set<string>;
	quotaKeys: Set<string>;
}

@Injectable()
export class OpenstackConstraintsService {
	private readonly constraints: ConstraintConfig;

	constructor(
		private readonly configService: ConfigService,
		private readonly terraformParser: OpenstackTerraformParserService
	) {
		this.constraints = {
			domains: this.bootstrapDomains(),
			quotaKeys: this.bootstrapQuotaKeys()
		};
	}

	public getAllowedDomains(): string[] {
		return Array.from(this.constraints.domains).sort();
	}

	public getAllowedQuotaKeys(): string[] {
		return Array.from(this.constraints.quotaKeys).sort();
	}

	public ensureDomainAllowed(domain: string): void {
		if (!domain) {
			throw new BadRequestException('OpenStack domain must be provided.');
		}

		if (!this.constraints.domains.has(domain)) {
			throw new BadRequestException(`Unsupported OpenStack domain "${domain}".`);
		}
	}

	public ensureQuotaKeysAllowed(quota: Record<string, unknown>): void {
		const keys = Object.keys(quota ?? {});
		for (const key of keys) {
			if (!this.constraints.quotaKeys.has(key)) {
				throw new BadRequestException(`Unsupported OpenStack quota key "${key}".`);
			}
		}
	}

	/**
	 * Validates that all provided flavor names are assignable (exist and are non-public).
	 */
	public ensureFlavorsAllowed(flavors: string[] | undefined): void {
		if (!flavors || flavors.length === 0) {
			return;
		}

		for (const flavorName of flavors) {
			if (!this.terraformParser.isFlavorAssignable(flavorName)) {
				throw new BadRequestException(
					`Invalid or non-assignable OpenStack flavor "${flavorName}". Only non-public flavors can be assigned.`
				);
			}
		}
	}

	/**
	 * Validates that all provided network names are assignable (exist and are non-shared).
	 */
	public ensureNetworksAllowed(
		networks: { accessAsExternal?: string[]; accessAsShared?: string[] } | undefined
	): void {
		if (!networks) {
			return;
		}

		const allNetworks = [...(networks.accessAsExternal ?? []), ...(networks.accessAsShared ?? [])];

		for (const networkName of allNetworks) {
			if (!this.terraformParser.isNetworkAssignable(networkName)) {
				throw new BadRequestException(
					`Invalid or non-assignable OpenStack network "${networkName}". Only non-shared networks can be assigned.`
				);
			}
		}

		// Check for duplicates within each access type
		this.ensureNoDuplicates(networks.accessAsExternal, 'access_as_external');
		this.ensureNoDuplicates(networks.accessAsShared, 'access_as_shared');
	}

	/**
	 * Ensures no duplicate network names within a single access type list.
	 */
	private ensureNoDuplicates(networks: string[] | undefined, accessType: string): void {
		if (!networks || networks.length === 0) {
			return;
		}

		const seen = new Set<string>();
		for (const network of networks) {
			if (seen.has(network)) {
				throw new BadRequestException(
					`Duplicate network "${network}" in ${accessType}. Each network can only appear once per access type.`
				);
			}
			seen.add(network);
		}
	}

	private bootstrapDomains(): Set<string> {
		const rawDomains = this.configService.get<string>('OPENSTACK_ALLOWED_DOMAINS');
		const parsedDomains = rawDomains
			?.split(',')
			.map((domain) => domain.trim())
			.filter((domain) => domain.length > 0);

		const fallbackDomains = ['einfra_cz'];
		return new Set(parsedDomains && parsedDomains.length > 0 ? parsedDomains : fallbackDomains);
	}

	private bootstrapQuotaKeys(): Set<string> {
		return new Set([
			// Nova
			'instances',
			'cores',
			'ram',
			'metadata_items',
			'key_pairs',
			'server_groups',
			'server_group_members',
			'injected_file_size',
			'injected_files',
			'injected_path_size',
			// Glance
			'properties',
			'image_storage',
			// Cinder
			'gigabytes',
			'snapshots',
			'volumes',
			'per_volume_gigabytes',
			'backup_gigabytes',
			'backups',
			'groups',
			'consistencygroups',
			// Neutron
			'network',
			'subnet',
			'floatingip',
			'port',
			'router',
			'security_group',
			'security_group_rule',
			// Octavia
			'loadbalancer',
			'listeners',
			'members',
			'pool',
			'health_monitors',
			// Barbican
			'secrets',
			'orders',
			'containers',
			'consumers',
			'cas',
			// RADOS
			'object'
		]);
	}
}
