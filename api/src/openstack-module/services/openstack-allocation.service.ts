import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
	AllocationOpenstackPayload,
	AllocationOpenstackRequest,
	Project,
	ProjectUserStatus
} from 'resource-manager-database';
import { OpenstackYamlBuilderService } from './openstack-yaml-builder.service';
import { OpenstackTagsCatalogService } from './openstack-tags.service';
import { OpenstackGitService } from './openstack-git.service';

interface TagLabelBundle {
	customerLabel: string;
	organizationLabel: string;
	workplaceLabel: string;
}

@Injectable()
export class OpenstackAllocationService {
	private readonly logger = new Logger(OpenstackAllocationService.name);
	private readonly allowedDomains: Set<string>;
	private readonly supportedResourceTypes: Set<string> = new Set(['openstack cloud']);

	constructor(
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly yamlBuilder: OpenstackYamlBuilderService,
		private readonly tagsCatalog: OpenstackTagsCatalogService,
		private readonly gitService: OpenstackGitService
	) {
		const rawDomains = this.configService.get<string>('OPENSTACK_ALLOWED_DOMAINS');
		const parsedDomains = rawDomains
			?.split(',')
			.map((domain) => domain.trim())
			.filter((domain) => domain.length > 0);
		this.allowedDomains = new Set(parsedDomains && parsedDomains.length > 0 ? parsedDomains : ['einfra_cz']);
	}

	public isResourceTypeSupported(resourceTypeName: string): boolean {
		return Boolean(resourceTypeName) && this.supportedResourceTypes.has(resourceTypeName.trim().toLowerCase());
	}

	public async processApprovedAllocation(allocationId: number): Promise<void> {
		const repository = this.dataSource.getRepository(AllocationOpenstackRequest);
		const request = await repository.findOne({
			relations: {
				allocation: {
					project: {
						pi: true,
						members: {
							user: true
						}
					},
					resource: {
						resourceType: true
					}
				}
			},
			where: {
				allocationId
			}
		});

		if (!request) {
			this.logger.debug(`Allocation ${allocationId} has no OpenStack payload. Skipping GitOps flow.`);
			return;
		}

		if (request.processed) {
			this.logger.debug(`Allocation ${allocationId} OpenStack payload already processed. Skipping.`);
			return;
		}

		const allocation = request.allocation;
		if (!allocation) {
			throw new BadRequestException(
				`Allocation with id ${allocationId} was not found during OpenStack processing.`
			);
		}

		const resourceTypeName = allocation.resource?.resourceType?.name ?? request.resourceType;
		if (!this.isResourceTypeSupported(resourceTypeName ?? '')) {
			this.logger.debug(
				`Allocation ${allocationId} uses resource type "${resourceTypeName}" which is not OpenStack-enabled. Skipping.`
			);
			return;
		}

		const project = allocation.project;
		if (!project) {
			throw new BadRequestException(`Project for allocation ${allocationId} was not found.`);
		}

		const payload = request.payload;
		this.ensureDomainSupported(payload.domain);

		const contacts = this.collectContacts(project);
		if (contacts.length === 0) {
			throw new BadRequestException(
				'OpenStack allocation requires at least one project member with a valid e-mail address.'
			);
		}

		const labels = this.tagsCatalog.resolveLabels(
			payload.customerKey,
			payload.organizationKey,
			payload.workplaceKey
		);

		const normalizedQuota = this.normalizeQuota(payload.quota);
		const projectSlug = this.yamlBuilder.slugifyProjectName(project.title);
		const yamlContent = this.yamlBuilder.buildYaml({
			projectName: project.title,
			projectDescription: payload.projectDescription,
			domain: payload.domain,
			contacts,
			disableDate: payload.disableDate,
			customerKey: payload.customerKey,
			organizationKey: payload.organizationKey,
			workplaceKey: payload.workplaceKey,
			quota: normalizedQuota,
			additionalTags: payload.additionalTags
		});

		const mergeRequestDescription = this.buildMergeRequestDescription({
			allocationId,
			project,
			payload,
			contacts,
			quota: normalizedQuota,
			labels
		});

		const result = await this.gitService.commitAndOpenMergeRequest({
			projectSlug,
			domain: payload.domain,
			yamlContent,
			mergeRequestTitle: `feat: openstack allocation for ${project.title}`,
			mergeRequestDescription,
			projectDisplayName: project.title
		});

		await repository.update(
			{ id: request.id },
			{
				processed: true,
				processedAt: new Date(),
				mergeRequestUrl: result.mergeRequestUrl,
				branchName: result.branch,
				yamlPath: result.filePath
			}
		);

		this.logger.log(
			`OpenStack merge request created for project "${project.title}" at ${result.mergeRequestUrl}.`
		);
	}

	private ensureDomainSupported(domain: string): void {
		if (!this.allowedDomains.has(domain)) {
			throw new BadRequestException(`Unsupported OpenStack domain "${domain}".`);
		}
	}

	private collectContacts(project: Project): string[] {
		const contacts = new Set<string>();

		if (project.pi?.email) {
			contacts.add(project.pi.email);
		}

		for (const member of project.members ?? []) {
			if (member.status === ProjectUserStatus.ACTIVE && member.user?.email) {
				contacts.add(member.user.email);
			}
		}

		return Array.from(contacts);
	}

	private normalizeQuota(quota: Record<string, number>): Record<string, number> {
		const normalized: Record<string, number> = {};

		for (const [key, value] of Object.entries(quota ?? {})) {
			const numericValue = Number(value);
			if (!Number.isFinite(numericValue)) {
				throw new BadRequestException(`Quota value for "${key}" must be numeric.`);
			}

			normalized[key] = numericValue;
		}

		return normalized;
	}

	private buildMergeRequestDescription(params: {
		allocationId: number;
		project: Project;
		payload: AllocationOpenstackPayload;
		contacts: string[];
		quota: Record<string, number>;
		labels: TagLabelBundle;
	}): string {
		const { allocationId, project, payload, contacts, quota, labels } = params;

		const quotaLines = Object.entries(quota)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => `- ${key}: ${value}`)
			.join('\n');

		const tagLines: string[] = [
			`- customer::${payload.customerKey} (${labels.customerLabel})`,
			`- organization::${payload.organizationKey} (${labels.organizationLabel})`,
			`- workplace::${payload.workplaceKey} (${labels.workplaceLabel})`
		];

		if (payload.additionalTags?.length) {
			for (const tag of payload.additionalTags) {
				tagLines.push(`- ${tag}`);
			}
		} else {
			tagLines.push('- additional tags: n/a');
		}

		return [
			'### Allocation context',
			`- Allocation ID: ${allocationId}`,
			`- Project ID: ${project.id}`,
			`- Project title: ${project.title}`,
			`- Requested domain: ${payload.domain}`,
			payload.disableDate ? `- Disable date: ${payload.disableDate}` : '- Disable date: not provided',
			'',
			'### Contact e-mails',
			contacts.map((email) => `- ${email}`).join('\n'),
			'',
			'### Tags',
			tagLines.join('\n'),
			'',
			'### Quota',
			quotaLines.length > 0 ? quotaLines : '- n/a'
		].join('\n');
	}
}
