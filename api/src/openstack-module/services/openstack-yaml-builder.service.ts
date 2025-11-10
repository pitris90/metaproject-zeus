import { Injectable } from '@nestjs/common';
import { stringify } from 'yaml';

interface OpenstackYamlBuilderInput {
	projectName: string;
	projectDescription: string;
	domain: string;
	contacts: string[];
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
		enabled: boolean;
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
		const base = projectName
			.normalize('NFKD')
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/-+/g, '-')
			.toLowerCase();

		return base.length > 0 ? base : 'project';
	}

	public buildYaml(input: OpenstackYamlBuilderInput): string {
		const contacts = Array.from(new Set(input.contacts.filter(Boolean))).sort((a, b) =>
			a.localeCompare(b)
		);

			const payload: OpenstackYamlPayload = {
			metadata: {
				contacts
			},
			project: {
				name: input.projectName,
				domain: input.domain,
				description: input.projectDescription,
				enabled: true,
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

		return stringify(payload, { indent: 2, lineWidth: 120 });
	}

	private buildTags(input: OpenstackYamlBuilderInput): string[] {
		const tags = [
			'meta',
			`customer::${input.customerKey}`,
			`organization::${input.organizationKey}`,
			`workplace::${input.workplaceKey}`
		];

		if (input.additionalTags?.length) {
			for (const tag of input.additionalTags) {
				if (tag && !tags.includes(tag)) {
					tags.push(tag);
				}
			}
		}

		return tags;
	}
}
