import { Injectable } from '@nestjs/common';
import { Alias, Document, Scalar, YAMLMap, YAMLSeq, isScalar, Pair } from 'yaml';

export interface OpenstackContactInfo {
	email: string;
	name?: string;
	externalId?: string;
}

export interface OpenstackNetworkAcls {
	accessAsExternal?: string[];
	accessAsShared?: string[];
}

interface OpenstackYamlBuilderInput {
	projectName: string;
	originalProjectName: string;
	projectDescription: string;
	domain: string;
	contacts: OpenstackContactInfo[];
	disableDate?: string;
	customerKey: string;
	organizationKey: string;
	workplaceKey: string;
	quota: Record<string, number>;
	additionalTags?: string[];
	/** OIDC sub (externalId) of the user who requested the allocation */
	requestorExternalId?: string;
	/** Optional list of non-public flavor names */
	flavors?: string[];
	/** Optional network ACL configuration */
	networks?: OpenstackNetworkAcls;
}

/**
 * Default roles assigned to projects via user-role-mappings.
 * This is configurable for future changes.
 */
const DEFAULT_PROJECT_ROLES = [
	'member',
	'reader',
	'creator',
	'load-balancer_member',
	'image_uploader',
	'heat_stack_user'
] as const;

/**
 * URN template for OIDC entitlement.
 * {projectName} will be replaced with the actual project name.
 */
const ENTITLEMENT_URN_PREFIX = 'urn:geant:cesnet.cz:res:';
const ENTITLEMENT_URN_SUFFIX = '#perun.cesnet.cz';

@Injectable()
export class OpenstackYamlBuilderService {
	/** Project name YAML anchor identifier */
	private static readonly PROJECT_NAME_ANCHOR = 'project-name';

	public slugifyProjectName(projectName: string): string {
		return this.slugify(projectName, 'project');
	}

	public buildPrefixedProjectName(customerKey: string, originalProjectName: string): string {
		const customerSlug = this.slugify(customerKey, '');
		const projectSlug = this.slugify(originalProjectName, 'project');
		return customerSlug ? `${customerSlug}-${projectSlug}` : projectSlug;
	}

	public buildYaml(input: OpenstackYamlBuilderInput): string {
		const contacts = this.normalizeContacts(input.contacts);

		// Create document with structured content
		const document = new Document({});
		const root = document.contents as YAMLMap;

		// Build metadata section
		this.buildMetadataSection(root, contacts, input.requestorExternalId, input.disableDate);

		// Build project section with anchor
		this.buildProjectSection(root, input);

		// Build quota section
		root.set('quota', input.quota ?? {});

		// Build acls section
		this.buildAclsSection(root, input);

		// Attach comments
		this.attachProjectNameComment(document, input.originalProjectName);
		this.attachContactComments(document, contacts);

		return document.toString({ indent: 2, lineWidth: 120 });
	}

	/**
	 * Builds the metadata section with contacts and principal-investigators.
	 */
	private buildMetadataSection(
		root: YAMLMap,
		contacts: OpenstackContactInfo[],
		requestorExternalId?: string,
		disableDate?: string
	): void {
		const metadata: Record<string, unknown> = {
			contacts: contacts.map((c) => c.email)
		};

		// Add principal-investigators if requestor externalId is available
		if (requestorExternalId) {
			metadata['principal-investigators'] = [requestorExternalId];
		}

		if (disableDate) {
			metadata['disable-date'] = disableDate;
		}

		root.set('metadata', metadata);
	}

	/**
	 * Builds the project section with YAML anchor on the name field.
	 * Returns the name scalar for use in creating aliases.
	 */
	private buildProjectSection(root: YAMLMap, input: OpenstackYamlBuilderInput): Scalar {
		const projectMap = new YAMLMap();

		// Create name scalar with anchor
		const nameScalar = new Scalar(input.projectName);
		nameScalar.anchor = OpenstackYamlBuilderService.PROJECT_NAME_ANCHOR;
		projectMap.add(new Pair('name', nameScalar));

		projectMap.set('domain', input.domain);
		projectMap.set('description', input.projectDescription);
		projectMap.set('parent', 'group-projects');
		projectMap.set('tags', this.buildTags(input));

		root.set('project', projectMap);

		return nameScalar;
	}

	/**
	 * Builds the acls section with flavors, networks, and user-role-mappings.
	 */
	private buildAclsSection(root: YAMLMap, input: OpenstackYamlBuilderInput): void {
		const acls = new YAMLMap();

		// Flavors - array of flavor names (can be empty)
		acls.set('flavors', input.flavors ?? []);

		// Networks - object with access_as_external and access_as_shared arrays
		this.buildNetworksAcl(acls, input.networks);

		// User-role-mappings - statically generated with alias to project name
		this.buildUserRoleMappings(acls, input.projectName);

		root.set('acls', acls);
	}

	/**
	 * Builds the networks ACL section.
	 */
	private buildNetworksAcl(acls: YAMLMap, networks?: OpenstackNetworkAcls): void {
		const networksMap = new YAMLMap();

		networksMap.set('access_as_external', networks?.accessAsExternal ?? []);
		networksMap.set('access_as_shared', networks?.accessAsShared ?? []);

		acls.set('networks', networksMap);
	}

	/**
	 * Builds the user-role-mappings section with YAML alias reference.
	 */
	private buildUserRoleMappings(acls: YAMLMap, projectName: string): void {
		// Create the projects array with alias reference
		const projectsSeq = new YAMLSeq();
		const projectEntry = new YAMLMap();

		// Create alias (reference) to the project-name anchor
		const nameAlias = new Alias('project-name');

		// Build roles array
		const rolesSeq = new YAMLSeq();
		for (const role of DEFAULT_PROJECT_ROLES) {
			const roleEntry = new YAMLMap();
			roleEntry.set('name', role);
			rolesSeq.add(roleEntry);
		}

		projectEntry.add(new Pair('name', nameAlias));
		projectEntry.set('roles', rolesSeq);
		projectsSeq.add(projectEntry);

		// Build local entry
		const localEntry = new YAMLMap();
		localEntry.set('projects', projectsSeq);

		const localSeq = new YAMLSeq();
		localSeq.add(localEntry);

		// Build remote entry
		const remoteEntry = new YAMLMap();
		remoteEntry.set('type', 'OIDC-eduperson_entitlement');

		const anyOneOfSeq = new YAMLSeq();
		anyOneOfSeq.add(`${ENTITLEMENT_URN_PREFIX}${projectName}${ENTITLEMENT_URN_SUFFIX}`);
		remoteEntry.set('any_one_of', anyOneOfSeq);

		const remoteSeq = new YAMLSeq();
		remoteSeq.add(remoteEntry);

		// Build the mapping entry
		const mappingEntry = new YAMLMap();
		mappingEntry.set('local', localSeq);
		mappingEntry.set('remote', remoteSeq);

		// Add to user-role-mappings
		const userRoleMappingsSeq = new YAMLSeq();
		userRoleMappingsSeq.add(mappingEntry);

		acls.set('user-role-mappings', userRoleMappingsSeq);
	}

	private buildTags(input: OpenstackYamlBuilderInput): string[] {
		const tags = new Set<string>([
			`customer::${input.customerKey}`,
			`organization::${input.organizationKey}`,
			`workplace::${input.workplaceKey}`
		]);

		for (const tag of input.additionalTags ?? []) {
			const trimmed = tag.trim();
			if (trimmed.length > 0) {
				tags.add(trimmed);
			}
		}

		return Array.from(tags);
	}

	private normalizeContacts(contacts: OpenstackContactInfo[]): OpenstackContactInfo[] {
		const unique = new Map<string, OpenstackContactInfo>();

		for (const contact of contacts ?? []) {
			const email = contact.email?.trim();
			if (!email) {
				continue;
			}

			const normalizedKey = email.toLowerCase();
			if (!unique.has(normalizedKey)) {
				unique.set(normalizedKey, {
					email,
					name: contact.name?.trim(),
					externalId: contact.externalId?.trim()
				});
			}
		}

		return Array.from(unique.values()).sort((a, b) => a.email.localeCompare(b.email));
	}

	private attachProjectNameComment(document: Document, originalName: string): void {
		const projectNode = document.get('project', true) as YAMLMap | undefined;
		if (!projectNode) {
			return;
		}

		const nameNode = projectNode.get('name', true) as Scalar | undefined;
		if (nameNode) {
			nameNode.comment = ` ${originalName}`;
		}
	}

	private attachContactComments(document: Document, contacts: OpenstackContactInfo[]): void {
		const metadataNode = document.get('metadata', true) as YAMLMap | undefined;
		if (!metadataNode) {
			return;
		}

		const contactsNode = metadataNode.get('contacts', true) as YAMLSeq | undefined;
		if (!contactsNode) {
			return;
		}

		contactsNode.items.forEach((item, index) => {
			const contact = contacts[index];
			if (!contact || !item || !isScalar(item)) {
				return;
			}

			const commentParts = [] as string[];
			if (contact.name) {
				commentParts.push(contact.name);
			}
			if (contact.externalId) {
				commentParts.push(contact.externalId);
			}

			if (commentParts.length > 0) {
				item.comment = ` ${commentParts.join(' ')}`;
			}
		});
	}

	private slugify(value: string, fallback: string): string {
		const base = (value ?? '').normalize('NFKD');
		const normalized = base
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase();

		if (normalized && normalized.length > 0) {
			return normalized;
		}

		return fallback;
	}
}
