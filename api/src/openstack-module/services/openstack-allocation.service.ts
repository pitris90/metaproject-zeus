import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	AllocationOpenstackPayload,
	AllocationOpenstackRequest,
	Project,
	ProjectUserStatus
} from 'resource-manager-database';
import { OpenstackContactInfo, OpenstackYamlBuilderService } from './openstack-yaml-builder.service';
import { OpenstackTagsCatalogService } from './openstack-tags.service';
import { OpenstackGitService } from './openstack-git.service';
import { OpenstackConstraintsService } from './openstack-constraints.service';

interface TagLabelBundle {
	customerLabel: string;
	organizationLabel: string;
	workplaceLabel: string;
}

@Injectable()
export class OpenstackAllocationService {
	private readonly logger = new Logger(OpenstackAllocationService.name);
	private readonly supportedResourceTypes: Set<string> = new Set(['openstack cloud']);

	constructor(
		private readonly dataSource: DataSource,
		private readonly yamlBuilder: OpenstackYamlBuilderService,
		private readonly tagsCatalog: OpenstackTagsCatalogService,
		private readonly gitService: OpenstackGitService,
		private readonly constraints: OpenstackConstraintsService
	) {
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
		this.validateRequestPayload(payload);

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
		const prefixedProjectName = this.yamlBuilder.buildPrefixedProjectName(payload.customerKey, project.title);
		const yamlContent = this.yamlBuilder.buildYaml({
			projectName: prefixedProjectName,
			originalProjectName: project.title,
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
			mergeRequestTitle: `${labels.organizationLabel}-${project.title}`,
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

	public validateRequestPayload(payload: AllocationOpenstackPayload): void {
		this.constraints.ensureDomainAllowed(payload.domain);
		this.constraints.ensureQuotaKeysAllowed(payload.quota ?? {});
	}

	private collectContacts(project: Project): OpenstackContactInfo[] {
		const contacts = new Map<string, OpenstackContactInfo>();

		const registerContact = (user?: { email?: string | null; name?: string | null; externalId?: string | null }) => {
			const email = user?.email?.trim();
			if (!email) {
				return;
			}

			const normalizedKey = email.toLowerCase();
			if (contacts.has(normalizedKey)) {
				return;
			}

			contacts.set(normalizedKey, {
				email,
				name: user?.name?.trim() || undefined,
				externalId: user?.externalId?.trim() || undefined
			});
		};

		registerContact(project.pi);

		for (const member of project.members ?? []) {
			if (member.status === ProjectUserStatus.ACTIVE) {
				registerContact(member.user);
			}
		}

		return Array.from(contacts.values());
	}

	private normalizeQuota(quota: Record<string, number>): Record<string, number> {
		this.constraints.ensureQuotaKeysAllowed(quota ?? {});

		const normalized: Record<string, number> = {};

		for (const [key, value] of Object.entries(quota ?? {})) {
			const numericValue = Number(value);
			if (!Number.isFinite(numericValue)) {
				throw new BadRequestException(`Quota value for "${key}" must be numeric.`);
			}

			if (numericValue < 0) {
				throw new BadRequestException(`Quota value for "${key}" must be zero or positive.`);
			}

			normalized[key] = numericValue;
		}

		return normalized;
	}

	private buildMergeRequestDescription(params: {
		allocationId: number;
		project: Project;
		payload: AllocationOpenstackPayload;
		contacts: OpenstackContactInfo[];
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
			contacts.map((contact) => `- ${contact.email}`).join('\n'),
			'',
			'### Tags',
			tagLines.join('\n'),
			'',
			'### Quota',
			quotaLines.length > 0 ? quotaLines : '- n/a'
		].join('\n');
	}
}
