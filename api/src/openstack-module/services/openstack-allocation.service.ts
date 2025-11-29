import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	AllocationOpenstackPayload,
	AllocationOpenstackRequest,
	AllocationUser,
	AllocationStatus,
	Project,
	ProjectUserStatus
} from 'resource-manager-database';
import { OpenstackContactInfo, OpenstackYamlBuilderService } from './openstack-yaml-builder.service';
import { OpenstackTagsCatalogService } from './openstack-tags.service';
import { OpenstackGitService } from './openstack-git.service';
import { OpenstackConstraintsService } from './openstack-constraints.service';

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
	) {}

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

		this.tagsCatalog.resolveLabels(payload.customerKey, payload.organizationKey, payload.workplaceKey);

		// Get the requestor's externalId from AllocationUser
		const requestorExternalId = await this.getRequestorExternalId(allocationId);

		const normalizedQuota = this.normalizeQuota(payload.quota);
		const openstackProjectName = this.yamlBuilder.buildPrefixedProjectName(payload.customerKey, project.title);
		const yamlContent = this.yamlBuilder.buildYaml({
			projectName: openstackProjectName,
			originalProjectName: project.title,
			projectDescription: payload.projectDescription,
			domain: payload.domain,
			contacts,
			disableDate: payload.disableDate,
			customerKey: payload.customerKey,
			organizationKey: payload.organizationKey,
			workplaceKey: payload.workplaceKey,
			quota: normalizedQuota,
			additionalTags: payload.additionalTags,
			requestorExternalId,
			flavors: payload.flavors,
			networks: payload.networks
		});

		const mergeRequestTitle = `feat: Project management via MetaCentrum ZEUS, project-name ${openstackProjectName}`;
		const mergeRequestDescription = `Project management via MetaCentrum ZEUS, project-name ${openstackProjectName}`;

		const result = await this.gitService.commitAndOpenMergeRequest({
			openstackProjectName,
			domain: payload.domain,
			yamlContent,
			mergeRequestTitle,
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

		this.logger.log(`OpenStack merge request created for project "${project.title}" at ${result.mergeRequestUrl}.`);
	}

	public validateRequestPayload(payload: AllocationOpenstackPayload): void {
		this.constraints.ensureDomainAllowed(payload.domain);
		this.constraints.ensureQuotaKeysAllowed(payload.quota ?? {});
		this.constraints.ensureFlavorsAllowed(payload.flavors);
		this.constraints.ensureNetworksAllowed(payload.networks);
	}

	/**
	 * Retrieves the externalId (OIDC sub) of the user who submitted the allocation request.
	 * The requestor is identified as the user in AllocationUser with status 'new' (initial request).
	 */
	private async getRequestorExternalId(allocationId: number): Promise<string | undefined> {
		const allocationUserRepository = this.dataSource.getRepository(AllocationUser);

		// Find the user who created the allocation request (status = 'new')
		const allocationUser = await allocationUserRepository.findOne({
			relations: {
				user: true
			},
			where: {
				allocationId,
				status: AllocationStatus.NEW
			}
		});

		if (!allocationUser?.user?.externalId) {
			this.logger.warn(
				`Could not find requestor externalId for allocation ${allocationId}. Principal-investigators will be empty.`
			);
			return undefined;
		}

		return allocationUser.user.externalId;
	}

	private collectContacts(project: Project): OpenstackContactInfo[] {
		const contacts = new Map<string, OpenstackContactInfo>();

		const registerContact = (user?: {
			email?: string | null;
			name?: string | null;
			externalId?: string | null;
		}) => {
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
}
