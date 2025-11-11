import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ConstraintConfig {
	domains: Set<string>;
	quotaKeys: Set<string>;
}

@Injectable()
export class OpenstackConstraintsService {
	private readonly constraints: ConstraintConfig;

	constructor(private readonly configService: ConfigService) {
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
