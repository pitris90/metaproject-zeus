import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	User,
	Project,
	ProjectStatus,
	Resource,
	ResourceType,
	Role,
	Allocation,
	AllocationStatus,
	AllocationOpenstackRequest,
	ResourceUsageEvent
} from 'resource-manager-database';

interface IdentityInfo {
	oidcSub?: string;
	email?: string;
	username?: string;
}

@Injectable()
export class ResourceUsageFakerService {
	constructor(private readonly dataSource: DataSource) {}

	async syncFromResourceUsage(): Promise<void> {
		console.log('Starting resource usage faker...');

		const eventRepo = this.dataSource.getRepository(ResourceUsageEvent);
		const events = await eventRepo.find();

		console.log(`Found ${events.length} resource usage events`);

		// Get required resources and role
		const openstackResource = await this.getOrCreateOpenstackResource();
		const pbsResource = await this.getOrCreatePbsResource();
		const adminRole = await this.getAdminRole();

		console.log(`Using OpenStack resource ID: ${openstackResource.id}`);
		console.log(`Using PBS resource ID: ${pbsResource.id}`);
		console.log(`Using Admin role ID: ${adminRole.id}`);

		const processedUsers = new Map<string, User>();
		const processedProjects = new Map<string, Project>();

		for (const event of events) {
			try {
				// Extract identity info
				const identityInfo = this.extractIdentityInfo(event.identities);

				// Get or create user
				const user = await this.getOrCreateUser(identityInfo, adminRole.id, processedUsers);

				// Get or create project
				const project = await this.getOrCreateProject(event.projectName, event.source, user, processedProjects);

				// Create allocation if it doesn't exist for this project
				if (event.source === 'openstack') {
					await this.ensureOpenstackAllocation(project, openstackResource, event);
				} else if (event.source === 'pbs') {
					await this.ensurePbsAllocation(project, pbsResource, event);
				}

				console.log(`Processed event ${event.id} for project "${project.title}"`);
			} catch (error) {
				console.error(`Failed to process event ${event.id}:`, error);
			}
		}

		console.log('Resource usage faker completed!');
	}

	private extractIdentityInfo(identities: any[]): IdentityInfo {
		const info: IdentityInfo = {};

		for (const identity of identities) {
			if (identity.scheme === 'oidc_sub') {
				info.oidcSub = identity.value;
			} else if (identity.scheme === 'user_email') {
				info.email = identity.value;
			} else if (identity.scheme === 'perun_username') {
				info.username = identity.value;
			}
		}

		return info;
	}

	private async getOrCreateUser(identityInfo: IdentityInfo, roleId: number, cache: Map<string, User>): Promise<User> {
		// Try to find by identifiers in priority order
		const cacheKey = identityInfo.oidcSub || identityInfo.email || identityInfo.username || 'unknown';

		if (cache.has(cacheKey)) {
			return cache.get(cacheKey)!;
		}

		const userRepo = this.dataSource.getRepository(User);

		// Try to find existing user
		let user: User | null = null;

		if (identityInfo.oidcSub) {
			user = await userRepo.findOne({
				where: { source: 'perun', externalId: identityInfo.oidcSub }
			});
		}

		if (!user && identityInfo.email) {
			user = await userRepo.findOne({
				where: { source: 'perun', email: identityInfo.email }
			});
		}

		if (!user && identityInfo.username) {
			user = await userRepo.findOne({
				where: { source: 'perun', username: identityInfo.username }
			});
		}

		// Create new user if not found
		if (!user) {
			console.log(`Creating new user: ${identityInfo.username || identityInfo.email || 'unknown'}`);

			user = userRepo.create({
				source: 'perun',
				externalId: identityInfo.oidcSub || undefined,
				email: identityInfo.email || `${identityInfo.username || cacheKey}@faked.local`,
				emailVerified: false,
				username: identityInfo.username || identityInfo.email?.split('@')[0] || cacheKey,
				name: identityInfo.username || identityInfo.email || cacheKey,
				roleId: roleId
			});

			user = await userRepo.save(user);
		}

		cache.set(cacheKey, user);
		return user;
	}

	private async getOrCreateProject(
		projectName: string | null,
		source: string,
		user: User,
		cache: Map<string, Project>
	): Promise<Project> {
		if (!projectName) {
			// Create personal project for user
			return this.getOrCreatePersonalProject(user, cache);
		}

		// Handle personal project marker
		if (projectName === '_pbs_project_default') {
			return this.getOrCreatePersonalProject(user, cache);
		}

		// Determine actual project slug
		let projectSlug = projectName;

		// For OpenStack, remove customer prefix
		if (source === 'openstack') {
			const firstDashIndex = projectName.indexOf('-');
			if (firstDashIndex !== -1) {
				projectSlug = projectName.substring(firstDashIndex + 1);
			}
		}

		const cacheKey = `${source}:${projectSlug}`;

		if (cache.has(cacheKey)) {
			return cache.get(cacheKey)!;
		}

		const projectRepo = this.dataSource.getRepository(Project);

		// Try to find by slug
		let project = await projectRepo.findOne({
			where: { projectSlug: projectSlug }
		});

		if (!project) {
			console.log(`Creating new project: ${projectSlug}`);

			project = projectRepo.create({
				title: projectSlug,
				projectSlug: projectSlug,
				description: `Project created from ${source} resource usage data`,
				piId: user.id,
				status: ProjectStatus.ACTIVE,
				isPersonal: false
			});

			project = await projectRepo.save(project);
		}

		cache.set(cacheKey, project);
		return project;
	}

	private async getOrCreatePersonalProject(user: User, cache: Map<string, Project>): Promise<Project> {
		const cacheKey = `personal:${user.id}`;

		if (cache.has(cacheKey)) {
			return cache.get(cacheKey)!;
		}

		const projectRepo = this.dataSource.getRepository(Project);

		// Try to find existing personal project by user
		let project = await projectRepo.findOne({
			where: { piId: user.id, isPersonal: true }
		});

		// If not found by user, try to find by title (in case it was created in a previous run)
		if (!project) {
			const title = `Personal project of ${user.username} - faked`;
			project = await projectRepo.findOne({
				where: { title: title }
			});
		}

		if (!project) {
			console.log(`Creating personal project for user: ${user.username}`);

			const title = `Personal project of ${user.username} - faked`;

			project = projectRepo.create({
				title: title,
				projectSlug: this.slugify(title),
				description: `Personal project created from resource usage data`,
				piId: user.id,
				status: ProjectStatus.ACTIVE,
				isPersonal: true
			});

			project = await projectRepo.save(project);
		}

		cache.set(cacheKey, project);
		return project;
	}

	private async ensureOpenstackAllocation(
		project: Project,
		resource: Resource,
		event: ResourceUsageEvent
	): Promise<void> {
		const allocationRepo = this.dataSource.getRepository(Allocation);

		// Check if allocation already exists
		const existing = await allocationRepo.findOne({
			where: {
				projectId: project.id,
				resourceId: resource.id
			}
		});

		if (existing) {
			return; // Already has allocation
		}

		console.log(`Creating OpenStack allocation for project: ${project.title}`);

		// Extract customer key from event
		const customerKey = this.extractCustomerKey(event.projectName || '');
		const vcpus = (event.metrics as any).vcpus_allocated || 4;

		// Create allocation
		const allocation = allocationRepo.create({
			projectId: project.id,
			resourceId: resource.id,
			status: AllocationStatus.ACTIVE,
			justification: 'Auto-created from resource usage data',
			description: 'OpenStack allocation',
			quantity: vcpus,
			startDate: new Date(),
			endDate: undefined,
			isLocked: false,
			isChangeable: true
		});

		const savedAllocation = await allocationRepo.save(allocation);

		// Create OpenStack request
		const openstackRequestRepo = this.dataSource.getRepository(AllocationOpenstackRequest);

		const openstackRequest = openstackRequestRepo.create({
			allocationId: savedAllocation.id,
			resourceType: 'OpenStack cloud',
			processed: true,
			processedAt: new Date(),
			payload: {
				domain: 'einfra_cz',
				projectDescription: project.description,
				customerKey: customerKey,
				organizationKey: this.getRandomOrganization(),
				workplaceKey: this.getRandomWorkplace(),
				quota: {
					cores: vcpus,
					ram: vcpus * 4096,
					instances: vcpus * 2
				}
			}
		});

		await openstackRequestRepo.save(openstackRequest);
	}

	private async ensurePbsAllocation(project: Project, resource: Resource, event: ResourceUsageEvent): Promise<void> {
		const allocationRepo = this.dataSource.getRepository(Allocation);

		// Check if allocation already exists
		const existing = await allocationRepo.findOne({
			where: {
				projectId: project.id,
				resourceId: resource.id
			}
		});

		if (existing) {
			return; // Already has allocation
		}

		console.log(`Creating PBS allocation for project: ${project.title}`);

		const cpuHours = Math.floor((event.metrics as any).cpu_time_seconds / 3600) || 100;

		// Create allocation
		const allocation = allocationRepo.create({
			projectId: project.id,
			resourceId: resource.id,
			status: AllocationStatus.ACTIVE,
			justification: 'Auto-created from PBS resource usage data',
			description: 'PBS compute allocation',
			quantity: cpuHours,
			startDate: new Date(),
			endDate: undefined,
			isLocked: false,
			isChangeable: true
		});

		await allocationRepo.save(allocation);
	}

	private extractCustomerKey(projectName: string): string {
		const firstDashIndex = projectName.indexOf('-');
		if (firstDashIndex === -1) {
			return 'metacentrum';
		}
		return projectName.substring(0, firstDashIndex);
	}

	private getRandomOrganization(): string {
		const orgs = ['metacentrum', 'cerit', 'cesnet'];
		return orgs[Math.floor(Math.random() * orgs.length)];
	}

	private getRandomWorkplace(): string {
		const workplaces = ['cloud', 'storage', 'compute', 'ics'];
		return workplaces[Math.floor(Math.random() * workplaces.length)];
	}

	private slugify(value: string): string {
		if (!value) return '';

		const base = value.normalize('NFKD');
		return base
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase();
	}

	private async getOrCreateOpenstackResource(): Promise<Resource> {
		const resourceRepo = this.dataSource.getRepository(Resource);

		let resource = await resourceRepo.findOne({
			where: { name: 'OpenStack' }
		});

		if (!resource) {
			const resourceTypeRepo = this.dataSource.getRepository(ResourceType);
			const resourceType = await resourceTypeRepo.findOne({
				where: { name: 'OpenStack cloud' }
			});

			if (!resourceType) {
				throw new Error('OpenStack cloud resource type not found. Please run seeders first.');
			}

			resource = resourceRepo.create({
				name: 'OpenStack',
				description: 'OpenStack projects managed via GitOps automation',
				isAvailable: true,
				resourceTypeId: resourceType.id
			});

			resource = await resourceRepo.save(resource);
		}

		return resource;
	}

	private async getOrCreatePbsResource(): Promise<Resource> {
		const resourceRepo = this.dataSource.getRepository(Resource);

		let resource = await resourceRepo.findOne({
			where: { name: 'PBS' }
		});

		if (!resource) {
			const resourceTypeRepo = this.dataSource.getRepository(ResourceType);
			const resourceType = await resourceTypeRepo.findOne({
				where: { name: 'Cluster' }
			});

			if (!resourceType) {
				throw new Error('Cluster resource type not found. Please run seeders first.');
			}

			console.log('Creating PBS resource...');

			resource = resourceRepo.create({
				name: 'PBS',
				description: 'Metacentrum grid/PBS resources',
				isAvailable: true,
				resourceTypeId: resourceType.id
			});

			resource = await resourceRepo.save(resource);
		}

		return resource;
	}

	private async getAdminRole(): Promise<Role> {
		const roleRepo = this.dataSource.getRepository(Role);

		const role = await roleRepo.findOne({
			where: { codeName: 'admin' }
		});

		if (!role) {
			throw new Error('Admin role not found. Please run seeders first.');
		}

		return role;
	}
}
