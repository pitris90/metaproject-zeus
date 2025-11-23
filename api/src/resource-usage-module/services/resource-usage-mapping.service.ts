import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Allocation,
	AllocationOpenstackRequest,
	Project,
	ResourceUsageEvent,
	ResourceUsageEventLink,
	User
} from 'resource-manager-database';
import { In, ILike, Repository } from 'typeorm';

interface IdentityMatchResult {
	user: User | null;
	scheme: string | null;
}

interface ProjectMatchResult {
	project: Project | null;
	strategy: string | null;
	openstackAllocation?: Allocation | null;
}

interface EventAssociation {
	event: ResourceUsageEvent;
	user: User | null;
	userScheme: string | null;
	project: Project | null;
	projectStrategy: string | null;
	allocation?: Allocation | null;
	allocationStrategy?: string | null;
}

interface ProjectCache {
	byTitle: Map<string, Project>;
	bySlug: Map<string, Project>;
}

interface OpenstackAllocationCacheEntry {
	allocation: Allocation;
	project: Project;
}

@Injectable()
export class ResourceUsageMappingService {
	private readonly logger = new Logger(ResourceUsageMappingService.name);

	constructor(
		@InjectRepository(ResourceUsageEventLink)
		private readonly linkRepository: Repository<ResourceUsageEventLink>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Project)
		private readonly projectRepository: Repository<Project>,
		@InjectRepository(Allocation)
		private readonly allocationRepository: Repository<Allocation>,
		@InjectRepository(AllocationOpenstackRequest)
		private readonly allocationOpenstackRepository: Repository<AllocationOpenstackRequest>
	) {}

	public async synchronizeAssociations(events: ResourceUsageEvent[]): Promise<void> {
		if (!events.length) {
			return;
		}

		const eventIds = events.map((event) => event.id);
		await this.linkRepository
			.createQueryBuilder()
			.delete()
			.where('event_id IN (:...eventIds)', { eventIds })
			.execute();

		const projectCache = await this.buildProjectCache();
		const openstackCache = await this.buildOpenstackAllocationCache();

		const associations: EventAssociation[] = [];

		for (const event of events) {
			const identityMatch = await this.resolveUser(event);
			const projectMatch = await this.resolveProject(event, identityMatch.user, projectCache, openstackCache);

			associations.push({
				event,
				user: identityMatch.user,
				userScheme: identityMatch.scheme,
				project: projectMatch.project,
				projectStrategy: projectMatch.strategy,
				allocation: projectMatch.openstackAllocation,
				allocationStrategy: projectMatch.openstackAllocation ? 'openstack_allocation_request' : null
			});
		}

		await this.hydrateAllocations(associations);
		await this.persistAssociations(associations);
	}

	private async resolveUser(event: ResourceUsageEvent): Promise<IdentityMatchResult> {
		const identities = Array.isArray(event.identities) ? event.identities : [];
		const priority = ['oidc_sub', 'user_email', 'perun_username'];

		for (const scheme of priority) {
			const identity = identities.find((candidate) => candidate?.scheme === scheme && candidate?.value);
			if (!identity) {
				continue;
			}

			const value = identity.value as string;
			const user = await this.lookupUserByScheme(scheme, value);
			if (user) {
				return { user, scheme };
			}
		}

		return { user: null, scheme: null };
	}

	private async lookupUserByScheme(scheme: string, value: string): Promise<User | null> {
		switch (scheme) {
			case 'oidc_sub':
				return this.userRepository.findOne({ where: { externalId: value } });
			case 'user_email':
				return this.userRepository.findOne({ where: { email: ILike(value) } });
			case 'perun_username':
				return this.userRepository.findOne({ where: { username: ILike(value) } });
			default:
				return null;
		}
	}

	private async resolveProject(
		event: ResourceUsageEvent,
		user: User | null,
		projectCache: ProjectCache,
		openstackCache: Map<string, OpenstackAllocationCacheEntry>
	): Promise<ProjectMatchResult> {
		const projectName = this.extractProjectName(event);
		if (!projectName) {
			return { project: null, strategy: null };
		}

		if (event.source === 'openstack') {
			const openstackMatch = openstackCache.get(projectName.toLowerCase());
			if (openstackMatch) {
				return {
					project: openstackMatch.project,
					strategy: 'openstack_allocation_request',
					openstackAllocation: openstackMatch.allocation
				};
			}
		}

		if (projectName === '_pbs_project_default' && user) {
			const personalProject = await this.projectRepository.findOne({
				where: {
					piId: user.id,
					isPersonal: true
				}
			});
			if (personalProject) {
				return { project: personalProject, strategy: 'personal_project' };
			}
		}

		const titleMatch = projectCache.byTitle.get(projectName.toLowerCase());
		if (titleMatch) {
			return { project: titleMatch, strategy: 'title_match' };
		}

		const slugMatch = projectCache.bySlug.get(this.slugify(projectName));
		if (slugMatch) {
			return { project: slugMatch, strategy: 'slug_match' };
		}

		return { project: null, strategy: null };
	}

	private extractProjectName(event: ResourceUsageEvent): string | null {
		const context = (event.context ?? {}) as Record<string, unknown>;
		const projectValue = context['project'] ?? context['project_name'] ?? context['projectTitle'];
		if (!projectValue) {
			return null;
		}
		const normalized = String(projectValue).trim();
		return normalized.length ? normalized : null;
	}

	private async buildProjectCache(): Promise<ProjectCache> {
		const projects = await this.projectRepository.find();
		const byTitle = new Map<string, Project>();
		const bySlug = new Map<string, Project>();

		for (const project of projects) {
			if (project.title) {
				byTitle.set(project.title.toLowerCase(), project);
				bySlug.set(this.slugify(project.title), project);
			}
		}

		return { byTitle, bySlug };
	}

	private async buildOpenstackAllocationCache(): Promise<Map<string, OpenstackAllocationCacheEntry>> {
		const requests = await this.allocationOpenstackRepository.find({
			relations: {
				allocation: {
					project: true
				}
			}
		});

		const cache = new Map<string, OpenstackAllocationCacheEntry>();
		for (const request of requests) {
			const allocation = request.allocation;
			const project = allocation?.project;
			const customerKey = request.payload?.customerKey;
			if (!allocation || !project || !customerKey) {
				continue;
			}
			const prefixedName = this.buildPrefixedProjectName(customerKey, project.title);
			cache.set(prefixedName.toLowerCase(), { allocation, project });
		}
		return cache;
	}

	private slugify(value: string): string {
		const base = (value ?? '').normalize('NFKD');
		return base
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase();
	}

	private buildPrefixedProjectName(customerKey: string, originalProjectName: string): string {
		const customerSlug = this.slugify(customerKey);
		const projectSlug = this.slugify(originalProjectName) || 'project';
		return customerSlug ? `${customerSlug}-${projectSlug}` : projectSlug;
	}

	private async hydrateAllocations(associations: EventAssociation[]): Promise<void> {
		const missingAllocationProjectIds = new Set<number>();
		for (const association of associations) {
			if (!association.project || association.allocation) {
				continue;
			}
			missingAllocationProjectIds.add(association.project.id);
		}

		if (!missingAllocationProjectIds.size) {
			return;
		}

		const allocationCandidates = await this.allocationRepository.find({
			where: {
				projectId: In(Array.from(missingAllocationProjectIds))
			},
			order: {
				startDate: 'DESC'
			}
		});

		const bestAllocationByProject = new Map<number, Allocation>();
		for (const allocation of allocationCandidates) {
			if (!bestAllocationByProject.has(allocation.projectId)) {
				bestAllocationByProject.set(allocation.projectId, allocation);
			}
		}

		for (const association of associations) {
			if (association.allocation || !association.project) {
				continue;
			}
			const allocation = bestAllocationByProject.get(association.project.id);
			if (allocation) {
				association.allocation = allocation;
				association.allocationStrategy = 'project_allocation_latest';
			}
		}
	}

	private async persistAssociations(associations: EventAssociation[]): Promise<void> {
		const rows = associations
			.filter((association) => association.user || association.project || association.allocation)
			.map((association) =>
				this.linkRepository.create({
					eventId: association.event.id,
					userId: association.user?.id ?? null,
					projectId: association.project?.id ?? null,
					allocationId: association.allocation?.id ?? null,
					userMatchScheme: association.userScheme,
					projectMatchStrategy: association.projectStrategy,
					allocationMatchStrategy: association.allocationStrategy ?? null
				})
			);

		if (!rows.length) {
			this.logger.debug('No resource usage associations created for current batch.');
			return;
		}

		await this.linkRepository.save(rows);
		this.logger.debug(`Persisted ${rows.length} resource usage associations.`);
	}
}
