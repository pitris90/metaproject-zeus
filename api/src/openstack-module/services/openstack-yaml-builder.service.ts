import { Injectable } from '@nestjs/common';
import { Document, Scalar, YAMLMap, YAMLSeq, isScalar } from 'yaml';

export interface OpenstackContactInfo {
	email: string;
	name?: string;
	externalId?: string;
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
}

interface OpenstackYamlPayload {
	metadata: Record<string, unknown>;
	project: {
		name: string;
		domain: string;
		description: string;
		parent: string;
		tags: string[];
	};
	quota: Record<string, number>;
	acls: {
		flavors: unknown[];
		'user-role-mappings': unknown[];
	};
}

@Injectable()
export class OpenstackYamlBuilderService {
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

		const payload: OpenstackYamlPayload = {
			metadata: {
				contacts: contacts.map((contact) => contact.email)
			},
			project: {
				name: input.projectName,
				domain: input.domain,
				description: input.projectDescription,
				parent: 'group-projects',
				tags: this.buildTags(input)
			},
			quota: (input.quota ?? {}) as Record<string, number>,
			acls: {
				flavors: [],
				'user-role-mappings': []
			}
		};

		if (input.disableDate) {
			payload.metadata['disable-date'] = input.disableDate;
		}

		const document = new Document(payload);
		this.attachProjectNameComment(document, input.originalProjectName);
		this.attachContactComments(document, contacts);

		return document.toString({ indent: 2, lineWidth: 120 });
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
