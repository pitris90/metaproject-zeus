import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppService } from '../../app.service';

/**
 * Represents a parsed OpenStack flavor from Terraform files.
 */
export interface OpenstackFlavor {
	name: string;
	ram: number;
	vcpus: number;
	isPublic: boolean;
}

/**
 * Represents a parsed OpenStack network from Terraform files.
 */
export interface OpenstackNetwork {
	name: string;
	shared: boolean;
}

/**
 * Configuration for supported OpenStack environments.
 * Each environment maps to a directory structure under openstack-external/environments/.
 */
interface EnvironmentConfig {
	name: string;
	basePath: string;
}

/**
 * Service responsible for parsing Terraform (.tf) files to extract
 * OpenStack flavor and network definitions.
 */
@Injectable()
export class OpenstackTerraformParserService {
	private readonly logger = new Logger(OpenstackTerraformParserService.name);

	/**
	 * Supported environments configuration.
	 * Currently only prod-brno is supported, but this is designed to be extensible.
	 */
	private readonly environments: EnvironmentConfig[];

	private readonly flavorsCache = new Map<string, OpenstackFlavor>();
	private readonly networksCache = new Map<string, OpenstackNetwork>();

	constructor(private readonly configService: ConfigService) {
		this.environments = this.buildEnvironmentConfigs();
		this.loadAllResources();
	}

	/**
	 * Returns all available flavors that are NOT public (is_public = false).
	 * These are the only flavors that can be assigned to projects.
	 */
	public getAssignableFlavors(): OpenstackFlavor[] {
		return Array.from(this.flavorsCache.values())
			.filter((flavor) => !flavor.isPublic)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Returns all available networks that are NOT shared (shared = false).
	 * These are the only networks that can be assigned to projects.
	 */
	public getAssignableNetworks(): OpenstackNetwork[] {
		return Array.from(this.networksCache.values())
			.filter((network) => !network.shared)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Checks if a flavor name is valid and assignable (exists and is_public = false).
	 */
	public isFlavorAssignable(flavorName: string): boolean {
		const flavor = this.flavorsCache.get(flavorName);
		return flavor !== undefined && !flavor.isPublic;
	}

	/**
	 * Checks if a network name is valid and assignable (exists and shared = false).
	 */
	public isNetworkAssignable(networkName: string): boolean {
		const network = this.networksCache.get(networkName);
		return network !== undefined && !network.shared;
	}

	/**
	 * Gets flavor details by name, or undefined if not found.
	 */
	public getFlavor(flavorName: string): OpenstackFlavor | undefined {
		return this.flavorsCache.get(flavorName);
	}

	/**
	 * Gets network details by name, or undefined if not found.
	 */
	public getNetwork(networkName: string): OpenstackNetwork | undefined {
		return this.networksCache.get(networkName);
	}

	/**
	 * Builds environment configurations.
	 * Currently only prod-brno is supported.
	 * To add more environments, add entries here.
	 */
	private buildEnvironmentConfigs(): EnvironmentConfig[] {
		const absoluteRepoPath = this.resolveRepositoryPath();

		// Currently supported environments - extend this array to add more
		const supportedEnvironments = ['prod-brno'] as const;

		return supportedEnvironments.map((envName) => ({
			name: envName,
			basePath: path.join(absoluteRepoPath, 'environments', envName, 'openstack')
		}));
	}

	/**
	 * Resolves the repository path using the same logic as OpenstackGitService.
	 */
	private resolveRepositoryPath(): string {
		const appRoot = AppService.APP_ROOT ?? path.resolve(__dirname, '..', '..', '..');
		const workspaceRoot = path.resolve(appRoot, '..');
		const configuredPath = this.configService.get<string>('OPENSTACK_REPO_PATH');

		if (configuredPath) {
			if (path.isAbsolute(configuredPath)) {
				return configuredPath;
			}
			return path.resolve(workspaceRoot, configuredPath);
		}

		return path.join(appRoot, 'src', 'openstack-module', 'openstack-external');
	}

	/**
	 * Loads all flavors and networks from all configured environments.
	 */
	private loadAllResources(): void {
		for (const env of this.environments) {
			this.loadFlavorsFromEnvironment(env);
			this.loadNetworksFromEnvironment(env);
		}

		this.logger.log(
			`Loaded ${this.flavorsCache.size} flavors (${this.getAssignableFlavors().length} assignable) ` +
				`and ${this.networksCache.size} networks (${this.getAssignableNetworks().length} assignable) ` +
				`from ${this.environments.length} environment(s).`
		);
	}

	/**
	 * Loads all flavor definitions from a specific environment.
	 */
	private loadFlavorsFromEnvironment(env: EnvironmentConfig): void {
		const flavorsDir = path.join(env.basePath, 'flavors');

		if (!fs.existsSync(flavorsDir)) {
			this.logger.warn(`Flavors directory not found for environment ${env.name}: ${flavorsDir}`);
			return;
		}

		const files = fs.readdirSync(flavorsDir).filter((f) => f.endsWith('.tf'));

		for (const file of files) {
			const filePath = path.join(flavorsDir, file);
			const flavor = this.parseFlavorFile(filePath);

			if (flavor) {
				// Use flavor name as key to avoid duplicates across environments
				if (!this.flavorsCache.has(flavor.name)) {
					this.flavorsCache.set(flavor.name, flavor);
				} else {
					this.logger.debug(
						`Duplicate flavor "${flavor.name}" found in ${env.name}, keeping first occurrence.`
					);
				}
			}
		}
	}

	/**
	 * Loads all network definitions from a specific environment.
	 */
	private loadNetworksFromEnvironment(env: EnvironmentConfig): void {
		const networksDir = path.join(env.basePath, 'networks');

		if (!fs.existsSync(networksDir)) {
			this.logger.warn(`Networks directory not found for environment ${env.name}: ${networksDir}`);
			return;
		}

		const files = fs.readdirSync(networksDir).filter((f) => f.endsWith('.tf'));

		for (const file of files) {
			const filePath = path.join(networksDir, file);
			const network = this.parseNetworkFile(filePath);

			if (network) {
				// Use network name as key to avoid duplicates across environments
				if (!this.networksCache.has(network.name)) {
					this.networksCache.set(network.name, network);
				} else {
					this.logger.debug(
						`Duplicate network "${network.name}" found in ${env.name}, keeping first occurrence.`
					);
				}
			}
		}
	}

	/**
	 * Parses a Terraform flavor file and extracts flavor definition.
	 * Expected format:
	 * ```
	 * resource "openstack_compute_flavor_v2" "resource_name" {
	 *   name  = "flavor-name"
	 *   ram   = "8192"
	 *   vcpus = "2"
	 *   is_public = false
	 *   ...
	 * }
	 * ```
	 */
	private parseFlavorFile(filePath: string): OpenstackFlavor | null {
		try {
			const content = fs.readFileSync(filePath, 'utf8');

			// Check if this is a flavor resource
			if (!content.includes('openstack_compute_flavor_v2')) {
				return null;
			}

			const name = this.extractStringValue(content, 'name');
			const ramStr = this.extractStringValue(content, 'ram');
			const vcpusStr = this.extractStringValue(content, 'vcpus');
			const isPublic = this.extractBooleanValue(content, 'is_public');

			if (!name) {
				this.logger.warn(`Could not extract flavor name from ${filePath}`);
				return null;
			}

			const ram = ramStr ? parseInt(ramStr, 10) : 0;
			const vcpus = vcpusStr ? parseInt(vcpusStr, 10) : 0;

			return {
				name,
				ram,
				vcpus,
				isPublic: isPublic ?? true // Default to public if not specified
			};
		} catch (error) {
			this.logger.error(`Error parsing flavor file ${filePath}: ${error}`);
			return null;
		}
	}

	/**
	 * Parses a Terraform network file and extracts network definition.
	 * Expected format:
	 * ```
	 * resource "openstack_networking_network_v2" "resource_name" {
	 *   name   = "network-name"
	 *   shared = false
	 *   ...
	 * }
	 * ```
	 */
	private parseNetworkFile(filePath: string): OpenstackNetwork | null {
		try {
			const content = fs.readFileSync(filePath, 'utf8');

			// Check if this is a network resource
			if (!content.includes('openstack_networking_network_v2')) {
				return null;
			}

			const name = this.extractStringValue(content, 'name');
			const shared = this.extractBooleanValue(content, 'shared');

			if (!name) {
				this.logger.warn(`Could not extract network name from ${filePath}`);
				return null;
			}

			return {
				name,
				shared: shared ?? true // Default to shared if not specified
			};
		} catch (error) {
			this.logger.error(`Error parsing network file ${filePath}: ${error}`);
			return null;
		}
	}

	/**
	 * Extracts a string value from Terraform HCL content.
	 * Matches patterns like: key = "value" or key  = "value"
	 */
	private extractStringValue(content: string, key: string): string | null {
		// Match: key = "value" with optional whitespace
		const regex = new RegExp(`${key}\\s*=\\s*"([^"]+)"`, 'i');
		const match = content.match(regex);
		return match ? match[1] : null;
	}

	/**
	 * Extracts a boolean value from Terraform HCL content.
	 * Matches patterns like: key = true or key = false
	 */
	private extractBooleanValue(content: string, key: string): boolean | null {
		// Match: key = true/false with optional whitespace
		const regex = new RegExp(`${key}\\s*=\\s*(true|false)`, 'i');
		const match = content.match(regex);
		return match ? match[1].toLowerCase() === 'true' : null;
	}
}
