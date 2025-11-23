import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AppService } from '../../app.service';

interface TagCatalogPaths {
	customers: string;
	organizations: string;
	workplaces: string;
}

interface TagCatalogResult {
	customerLabel: string;
	organizationLabel: string;
	workplaceLabel: string;
}

export interface OpenstackCatalogEntry {
	key: string;
	label: string;
}

export interface OpenstackWorkplaceCatalogEntry extends OpenstackCatalogEntry {
	organizationKey: string;
}

export interface OpenstackCatalogResponse {
	customers: OpenstackCatalogEntry[];
	organizations: OpenstackCatalogEntry[];
	workplaces: OpenstackWorkplaceCatalogEntry[];
}

@Injectable()
export class OpenstackTagsCatalogService {
	private readonly logger = new Logger(OpenstackTagsCatalogService.name);

	private readonly customerLabels = new Map<string, string>();
	private readonly organizationLabels = new Map<string, string>();
	private readonly workplaceLabels = new Map<string, Map<string, string>>();

	constructor() {
		this.bootstrapCatalog();
	}

	public resolveLabels(customerKey: string, organizationKey: string, workplaceKey: string): TagCatalogResult {
		const customerLabel = this.customerLabels.get(customerKey) ?? (customerKey === 'meta' ? 'meta' : undefined);
		if (!customerLabel) {
			throw new BadRequestException(`Unknown OpenStack customer key "${customerKey}".`);
		}

		const organizationLabel = this.organizationLabels.get(organizationKey);
		if (!organizationLabel) {
			throw new BadRequestException(`Unknown OpenStack organization key "${organizationKey}".`);
		}

		const workplacePerOrganization = this.workplaceLabels.get(organizationKey);
		if (!workplacePerOrganization) {
			throw new BadRequestException(
				`Organization "${organizationKey}" does not define any workplaces in the OpenStack catalog.`
			);
		}

		const workplaceLabel = workplacePerOrganization.get(workplaceKey);
		if (!workplaceLabel) {
			throw new BadRequestException(
				`Unknown OpenStack workplace key "${workplaceKey}" for organization "${organizationKey}".`
			);
		}

		return { customerLabel, organizationLabel, workplaceLabel };
	}

	private bootstrapCatalog(): void {
		const paths = this.buildCatalogPaths();
		this.loadCustomers(paths.customers);
		this.loadOrganizations(paths.organizations);
		this.loadWorkplaces(paths.workplaces);
	}

	public getCatalog(): OpenstackCatalogResponse {
		return {
			customers: Array.from(this.customerLabels.entries()).map(([key, label]) => ({ key, label })),
			organizations: Array.from(this.organizationLabels.entries()).map(([key, label]) => ({ key, label })),
			workplaces: Array.from(this.workplaceLabels.entries()).flatMap(([organizationKey, workplaces]) =>
				Array.from(workplaces.entries()).map(([key, label]) => ({ organizationKey, key, label }))
			)
		};
	}

	private buildCatalogPaths(): TagCatalogPaths {
		const repoRoot = AppService.APP_ROOT ?? path.resolve(__dirname, '..', '..', '..');
		const catalogRoot = path.join(
			repoRoot,
			'src',
			'openstack-module',
			'openstack-external',
			'ci',
			'ostack-project-tags-enums'
		);

		return {
			customers: path.join(catalogRoot, 'ostack-projects-customers.csv'),
			organizations: path.join(catalogRoot, 'ostack-projects-organizations.csv'),
			workplaces: path.join(catalogRoot, 'ostack-projects-workplaces.csv')
		};
	}

	private loadCustomers(filePath: string): void {
		for (const [key, text] of this.readTwoColumnCsv(filePath)) {
			this.customerLabels.set(key, text);
		}

		this.logger.debug(`Loaded ${this.customerLabels.size} OpenStack customer keys.`);
	}

	private loadOrganizations(filePath: string): void {
		for (const [key, text] of this.readTwoColumnCsv(filePath)) {
			this.organizationLabels.set(key, text);
		}

		this.logger.debug(`Loaded ${this.organizationLabels.size} OpenStack organization keys.`);
	}

	private loadWorkplaces(filePath: string): void {
		const content = this.readCsv(filePath);
		for (const row of content) {
			const [organizationKey, workplaceKey, workplaceText] = row;
			if (!organizationKey || !workplaceKey) {
				continue;
			}

			if (!this.workplaceLabels.has(organizationKey)) {
				this.workplaceLabels.set(organizationKey, new Map<string, string>());
			}

			this.workplaceLabels.get(organizationKey)!.set(workplaceKey, workplaceText ?? workplaceKey);
		}

		this.logger.debug(`Loaded OpenStack workplaces for ${this.workplaceLabels.size} organizations.`);
	}

	private readTwoColumnCsv(filePath: string): Array<[string, string]> {
		const rows = this.readCsv(filePath);
		return rows.map(([key, text]) => [key, text ?? key]);
	}

	private readCsv(filePath: string): string[][] {
		if (!fs.existsSync(filePath)) {
			throw new Error(`OpenStack catalog file not found: ${filePath}`);
		}

		const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
		return raw
			.split(/\r?\n/)
			.slice(1) // skip header row
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => line.replace(/^"|"$/g, ''))
			.map((line) => line.split(',').map((cell) => cell.trim()));
	}
}
