import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
	User,
	Project,
	ProjectStatus,
	ProjectUser,
	ProjectUserRole,
	ProjectUserStatus,
	Resource,
	ResourceType,
	Role,
	Allocation,
	AllocationStatus,
	AllocationOpenstackRequest,
	OpenstackRequestStatus,
	ResourceUsageEvent
} from 'resource-manager-database';

// ============================================================================
// CONFIGURATION - Adjust these values to control test data generation
// ============================================================================

/** Number of test users to create */
const CONFIG_USER_COUNT = 1;

/** Number of group projects per user (non-personal) */
const CONFIG_PROJECTS_PER_USER = 3;

/** Whether to create personal projects for users */
const CONFIG_CREATE_PERSONAL_PROJECTS = true;

/** Number of additional members per group project */
const CONFIG_MEMBERS_PER_PROJECT = 2;

/** Date range for generating events (days back from today) */
const CONFIG_EVENT_DATE_RANGE_DAYS = 30;

// --- PBS Configuration ---
/** Total number of PBS events to generate */
const CONFIG_PBS_EVENT_COUNT = 150;

/** Distribution: percentage of PBS events that are personal (0-100) */
const CONFIG_PBS_PERSONAL_PERCENTAGE = 30;

// --- OpenStack Configuration ---
/** Total number of OpenStack events to generate */
const CONFIG_OPENSTACK_EVENT_COUNT = 100;

/** Distribution: percentage of OpenStack events that are personal (0-100) */
const CONFIG_OPENSTACK_PERSONAL_PERCENTAGE = 20;

// --- Customer Keys for OpenStack ---
/** Available customer keys for OpenStack project naming */
const CONFIG_CUSTOMER_KEYS = ['metacentrum', 'cerit-sc', 'elixir', 'deep', 'mu'];

// --- Metrics Ranges ---
const CONFIG_PBS_CPU_TIME_MIN = 60; // seconds
const CONFIG_PBS_CPU_TIME_MAX = 86400; // 24 hours
const CONFIG_PBS_WALLTIME_MIN = 60;
const CONFIG_PBS_WALLTIME_MAX = 172800; // 48 hours
const CONFIG_PBS_RAM_MIN = 1024 * 1024 * 512; // 512 MB
const CONFIG_PBS_RAM_MAX = 1024 * 1024 * 1024 * 64; // 64 GB

const CONFIG_OPENSTACK_VCPUS_MIN = 1;
const CONFIG_OPENSTACK_VCPUS_MAX = 32;
const CONFIG_OPENSTACK_RAM_MIN = 1024 * 1024 * 1024; // 1 GB
const CONFIG_OPENSTACK_RAM_MAX = 1024 * 1024 * 1024 * 128; // 128 GB
const CONFIG_OPENSTACK_DISK_MIN = 10; // GB
const CONFIG_OPENSTACK_DISK_MAX = 500; // GB

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

interface GeneratedUser {
	user: User;
	personalProject?: Project;
	groupProjects: Project[];
}

@Injectable()
export class TestDataGeneratorService {
	private readonly logger = new Logger(TestDataGeneratorService.name);

	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Main entry point - generates complete test environment
	 */
	async generateTestData(): Promise<void> {
		this.logger.log('='.repeat(60));
		this.logger.log('Starting Test Data Generation');
		this.logger.log('='.repeat(60));
		this.logConfiguration();

		// Get required resources
		const openstackResource = await this.getOrCreateOpenstackResource();
		const pbsResource = await this.getOrCreatePbsResource();
		const userRole = await this.getUserRole();

		this.logger.log(`OpenStack Resource ID: ${openstackResource.id}`);
		this.logger.log(`PBS Resource ID: ${pbsResource.id}`);

		// Generate users and their projects
		const generatedUsers: GeneratedUser[] = [];
		for (let i = 0; i < CONFIG_USER_COUNT; i++) {
			const generated = await this.generateUserWithProjects(userRole.id, i);
			generatedUsers.push(generated);

			// Create allocations for projects
			for (const project of generated.groupProjects) {
				await this.createAllocationsForProject(project, openstackResource, pbsResource);
			}
			if (generated.personalProject) {
				await this.createAllocationsForProject(generated.personalProject, openstackResource, pbsResource);
			}
		}

		// Generate resource usage events
		await this.generatePbsEvents(generatedUsers);
		await this.generateOpenstackEvents(generatedUsers);

		// Backfill project mapping
		await this.backfillProjectMapping(generatedUsers);

		this.logger.log('='.repeat(60));
		this.logger.log('Test Data Generation Complete!');
		this.logger.log('='.repeat(60));
		this.printSummary(generatedUsers);
	}

	private logConfiguration(): void {
		this.logger.log('Configuration:');
		this.logger.log(`  Users: ${CONFIG_USER_COUNT}`);
		this.logger.log(`  Projects per user: ${CONFIG_PROJECTS_PER_USER}`);
		this.logger.log(`  Personal projects: ${CONFIG_CREATE_PERSONAL_PROJECTS ? 'Yes' : 'No'}`);
		this.logger.log(`  PBS events: ${CONFIG_PBS_EVENT_COUNT} (${CONFIG_PBS_PERSONAL_PERCENTAGE}% personal)`);
		this.logger.log(
			`  OpenStack events: ${CONFIG_OPENSTACK_EVENT_COUNT} (${CONFIG_OPENSTACK_PERSONAL_PERCENTAGE}% personal)`
		);
		this.logger.log(`  Date range: last ${CONFIG_EVENT_DATE_RANGE_DAYS} days`);
	}

	// =========================================================================
	// User and Project Generation
	// =========================================================================

	private async generateUserWithProjects(roleId: number, index: number): Promise<GeneratedUser> {
		const userRepo = this.dataSource.getRepository(User);
		const projectRepo = this.dataSource.getRepository(Project);

		// Create user with realistic identifiers
		const username = index === 0 ? 'testuser' : `testuser${index + 1}`;
		const email = `${username}@test.metacentrum.cz`;
		const externalId = faker.string.uuid();

		let user = await userRepo.findOne({ where: { username } });
		if (!user) {
			user = userRepo.create({
				source: 'perun',
				externalId,
				email,
				emailVerified: true,
				username,
				name: `Test User ${index + 1}`,
				roleId
			});
			user = await userRepo.save(user);
			this.logger.log(`Created user: ${username} (ID: ${user.id}, externalId: ${externalId})`);
		} else {
			this.logger.log(`Using existing user: ${username} (ID: ${user.id})`);
		}

		const result: GeneratedUser = {
			user,
			groupProjects: []
		};

		// Create personal project
		if (CONFIG_CREATE_PERSONAL_PROJECTS) {
			const personalTitle = `Personal project of ${username}`;
			let personalProject = await projectRepo.findOne({
				where: { piId: user.id, isPersonal: true }
			});

			if (!personalProject) {
				personalProject = projectRepo.create({
					title: personalTitle,
					projectSlug: this.slugify(personalTitle),
					description: 'Personal project for testing',
					piId: user.id,
					status: ProjectStatus.ACTIVE,
					isPersonal: true
				});
				personalProject = await projectRepo.save(personalProject);
				this.logger.log(`Created personal project: ${personalProject.title} (ID: ${personalProject.id})`);
			}
			result.personalProject = personalProject;
		}

		// Create group projects
		const projectNames = [
			'climate-modeling-research',
			'genomics-analysis-pipeline',
			'machine-learning-experiments',
			'quantum-chemistry-simulations',
			'astrophysics-data-processing',
			'bioinformatics-toolkit',
			'neural-network-training',
			'molecular-dynamics-study'
		];

		for (let i = 0; i < CONFIG_PROJECTS_PER_USER; i++) {
			const projectSlug = projectNames[i % projectNames.length] + (index > 0 ? `-${index}` : '');
			const projectTitle = projectSlug
				.split('-')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ');

			let project = await projectRepo.findOne({ where: { projectSlug } });
			if (!project) {
				project = projectRepo.create({
					title: projectTitle,
					projectSlug,
					description: `Test project for ${projectTitle}`,
					piId: user.id,
					status: ProjectStatus.ACTIVE,
					isPersonal: false
				});
				project = await projectRepo.save(project);
				this.logger.log(`Created group project: ${project.projectSlug} (ID: ${project.id})`);

				// Add members
				await this.addProjectMembers(project);
			}
			result.groupProjects.push(project);
		}

		return result;
	}

	private async addProjectMembers(project: Project): Promise<void> {
		const userRepo = this.dataSource.getRepository(User);
		const projectUserRepo = this.dataSource.getRepository(ProjectUser);
		const userRole = await this.getUserRole();

		for (let i = 0; i < CONFIG_MEMBERS_PER_PROJECT; i++) {
			const memberUsername = `member_${project.projectSlug}_${i + 1}`;
			let member = await userRepo.findOne({ where: { username: memberUsername } });

			if (!member) {
				member = userRepo.create({
					source: 'perun',
					externalId: faker.string.uuid(),
					email: `${memberUsername}@test.metacentrum.cz`,
					emailVerified: true,
					username: memberUsername,
					name: `Member ${i + 1} of ${project.title}`,
					roleId: userRole.id
				});
				member = await userRepo.save(member);
			}

			// Add as project member
			const existingMembership = await projectUserRepo.findOne({
				where: { projectId: project.id, userId: member.id }
			});

			if (!existingMembership) {
				const membership = projectUserRepo.create({
					projectId: project.id,
					userId: member.id,
					role: i === 0 ? ProjectUserRole.MANAGER : ProjectUserRole.USER,
					status: ProjectUserStatus.ACTIVE
				});
				await projectUserRepo.save(membership);
			}
		}
	}

	// =========================================================================
	// Allocation Creation
	// =========================================================================

	private async createAllocationsForProject(
		project: Project,
		openstackResource: Resource,
		pbsResource: Resource
	): Promise<void> {
		const allocationRepo = this.dataSource.getRepository(Allocation);

		// PBS allocation
		const existingPbs = await allocationRepo.findOne({
			where: { projectId: project.id, resourceId: pbsResource.id }
		});

		if (!existingPbs) {
			const pbsAllocation = allocationRepo.create({
				projectId: project.id,
				resourceId: pbsResource.id,
				status: AllocationStatus.ACTIVE,
				justification: 'Test allocation for PBS compute resources',
				description: 'PBS compute allocation',
				quantity: faker.number.int({ min: 1000, max: 100000 }),
				startDate: new Date(),
				isLocked: false,
				isChangeable: true
			});
			await allocationRepo.save(pbsAllocation);
		}

		// OpenStack allocation (only for group projects)
		if (!project.isPersonal) {
			const existingOpenstack = await allocationRepo.findOne({
				where: { projectId: project.id, resourceId: openstackResource.id }
			});

			if (!existingOpenstack) {
				const openstackAllocation = allocationRepo.create({
					projectId: project.id,
					resourceId: openstackResource.id,
					status: AllocationStatus.ACTIVE,
					justification: 'Test allocation for OpenStack cloud resources',
					description: 'OpenStack cloud allocation',
					quantity: faker.number.int({ min: 4, max: 64 }),
					startDate: new Date(),
					isLocked: false,
					isChangeable: true
				});
				const savedAllocation = await allocationRepo.save(openstackAllocation);

				// Create OpenStack request
				await this.createOpenstackRequest(savedAllocation, project);
			}
		}
	}

	private async createOpenstackRequest(allocation: Allocation, project: Project): Promise<void> {
		const openstackRequestRepo = this.dataSource.getRepository(AllocationOpenstackRequest);

		const customerKey = faker.helpers.arrayElement(CONFIG_CUSTOMER_KEYS);
		const vcpus = allocation.quantity;

		const request = openstackRequestRepo.create({
			allocation,
			status: OpenstackRequestStatus.APPROVED,
			processed: true,
			processedAt: new Date(),
			payload: {
				domain: 'einfra_cz',
				projectDescription: project.description,
				customerKey,
				organizationKey: faker.helpers.arrayElement(['metacentrum', 'cerit', 'cesnet']),
				workplaceKey: faker.helpers.arrayElement(['cloud', 'storage', 'compute']),
				quota: {
					cores: vcpus,
					ram: vcpus * 4096,
					instances: vcpus * 2
				}
			}
		});

		await openstackRequestRepo.save(request);
	}

	// =========================================================================
	// PBS Event Generation
	// =========================================================================

	private async generatePbsEvents(generatedUsers: GeneratedUser[]): Promise<void> {
		this.logger.log(`Generating ${CONFIG_PBS_EVENT_COUNT} PBS events...`);

		const eventRepo = this.dataSource.getRepository(ResourceUsageEvent);
		const personalEventCount = Math.floor((CONFIG_PBS_EVENT_COUNT * CONFIG_PBS_PERSONAL_PERCENTAGE) / 100);
		const groupEventCount = CONFIG_PBS_EVENT_COUNT - personalEventCount;

		const events: Partial<ResourceUsageEvent>[] = [];

		// Generate personal PBS events
		for (let i = 0; i < personalEventCount; i++) {
			const generated = faker.helpers.arrayElement(generatedUsers);
			if (!generated.personalProject) continue;

			events.push(this.createPbsEvent(generated.user, generated.personalProject, true));
		}

		// Generate group PBS events
		for (let i = 0; i < groupEventCount; i++) {
			const generated = faker.helpers.arrayElement(generatedUsers);
			const project = faker.helpers.arrayElement(generated.groupProjects);

			events.push(this.createPbsEvent(generated.user, project, false));
		}

		// Batch insert
		for (const chunk of this.chunk(events, 100)) {
			await eventRepo.insert(chunk as any);
		}

		this.logger.log(`Created ${events.length} PBS events`);
	}

	private createPbsEvent(user: User, project: Project, isPersonal: boolean): Partial<ResourceUsageEvent> {
		const startDate = faker.date.recent({ days: CONFIG_EVENT_DATE_RANGE_DAYS });
		const durationSeconds = faker.number.int({ min: 60, max: 7200 });
		const endDate = new Date(startDate.getTime() + durationSeconds * 1000);

		const cpuTimeSeconds = faker.number.int({ min: CONFIG_PBS_CPU_TIME_MIN, max: CONFIG_PBS_CPU_TIME_MAX });
		const walltimeUsed = faker.number.int({ min: CONFIG_PBS_WALLTIME_MIN, max: CONFIG_PBS_WALLTIME_MAX });

		return {
			time_window_start: startDate,
			time_window_end: endDate,
			collected_at: new Date(),
			schema_version: '1.0',
			source: 'pbs',
			projectSlug: isPersonal ? '_pbs_project_default' : project.projectSlug,
			isPersonal,
			projectId: null, // Will be filled by backfill
			metrics: {
				cpu_time_seconds: cpuTimeSeconds,
				walltime_allocated: Math.floor(walltimeUsed * 1.2),
				walltime_used: walltimeUsed,
				ram_bytes_allocated: faker.number.int({ min: CONFIG_PBS_RAM_MIN, max: CONFIG_PBS_RAM_MAX }),
				ram_bytes_used: faker.number.int({ min: CONFIG_PBS_RAM_MIN, max: CONFIG_PBS_RAM_MAX }),
				used_cpu_percent: faker.number.float({ min: 10, max: 100, fractionDigits: 2 })
			},
			identities: [
				{ scheme: 'oidc_sub', value: user.externalId || '' },
				{ scheme: 'perun_username', value: user.username },
				{ scheme: 'user_email', value: user.email }
			],
			context: {
				jobname:
					faker.helpers.arrayElement([
						'simulation_run',
						'data_analysis',
						'model_training',
						'batch_process',
						'compute_task'
					]) + `_${faker.string.alphanumeric(6)}`,
				queue: faker.helpers.arrayElement(['default', 'long', 'gpu', 'express']),
				hostname: `node${faker.number.int({ min: 1, max: 100 })}.metacentrum.cz`
			},
			extra: null
		};
	}

	// =========================================================================
	// OpenStack Event Generation
	// =========================================================================

	private async generateOpenstackEvents(generatedUsers: GeneratedUser[]): Promise<void> {
		this.logger.log(`Generating ${CONFIG_OPENSTACK_EVENT_COUNT} OpenStack events...`);

		const eventRepo = this.dataSource.getRepository(ResourceUsageEvent);
		const personalEventCount = Math.floor(
			(CONFIG_OPENSTACK_EVENT_COUNT * CONFIG_OPENSTACK_PERSONAL_PERCENTAGE) / 100
		);
		const groupEventCount = CONFIG_OPENSTACK_EVENT_COUNT - personalEventCount;

		const events: Partial<ResourceUsageEvent>[] = [];

		// Generate personal OpenStack events
		for (let i = 0; i < personalEventCount; i++) {
			const generated = faker.helpers.arrayElement(generatedUsers);
			if (!generated.personalProject) continue;

			events.push(this.createOpenstackEvent(generated.user, generated.personalProject, true));
		}

		// Generate group OpenStack events
		for (let i = 0; i < groupEventCount; i++) {
			const generated = faker.helpers.arrayElement(generatedUsers);
			const project = faker.helpers.arrayElement(generated.groupProjects);

			events.push(this.createOpenstackEvent(generated.user, project, false));
		}

		// Batch insert
		for (const chunk of this.chunk(events, 100)) {
			await eventRepo.insert(chunk as any);
		}

		this.logger.log(`Created ${events.length} OpenStack events`);
	}

	private createOpenstackEvent(user: User, project: Project, isPersonal: boolean): Partial<ResourceUsageEvent> {
		const startDate = faker.date.recent({ days: CONFIG_EVENT_DATE_RANGE_DAYS });
		const durationSeconds = faker.number.int({ min: 3600, max: 86400 }); // 1-24 hours
		const endDate = new Date(startDate.getTime() + durationSeconds * 1000);

		const vcpus = faker.number.int({ min: CONFIG_OPENSTACK_VCPUS_MIN, max: CONFIG_OPENSTACK_VCPUS_MAX });
		const ramBytes = faker.number.int({ min: CONFIG_OPENSTACK_RAM_MIN, max: CONFIG_OPENSTACK_RAM_MAX });

		// For group projects, prefix with customer key
		let projectSlug: string;
		if (isPersonal) {
			projectSlug = user.externalId || user.username; // Personal projects use user identifier
		} else {
			const customerKey = faker.helpers.arrayElement(CONFIG_CUSTOMER_KEYS);
			projectSlug = `${customerKey}-${project.projectSlug}`;
		}

		return {
			time_window_start: startDate,
			time_window_end: endDate,
			collected_at: new Date(),
			schema_version: '1.0',
			source: 'openstack',
			projectSlug,
			isPersonal,
			projectId: null, // Will be filled by backfill
			metrics: {
				cpu_time_seconds: vcpus * durationSeconds,
				vcpus_allocated: vcpus,
				ram_bytes_allocated: ramBytes,
				ram_bytes_used: Math.floor(ramBytes * faker.number.float({ min: 0.3, max: 0.95 })),
				disk_allocated: faker.number.int({ min: CONFIG_OPENSTACK_DISK_MIN, max: CONFIG_OPENSTACK_DISK_MAX }),
				storage_bytes_allocated:
					faker.number.int({ min: CONFIG_OPENSTACK_DISK_MIN, max: CONFIG_OPENSTACK_DISK_MAX }) *
					1024 *
					1024 *
					1024
			},
			identities: [
				{ scheme: 'oidc_sub', value: user.externalId || '' },
				{ scheme: 'perun_username', value: user.username },
				{ scheme: 'user_email', value: user.email }
			],
			context: {
				instance_name:
					faker.helpers.arrayElement(['web-server', 'db-server', 'compute-node', 'worker']) +
					`-${faker.string.alphanumeric(4)}`,
				flavor: faker.helpers.arrayElement(['m1.small', 'm1.medium', 'm1.large', 'm1.xlarge', 'c1.large']),
				availability_zone: faker.helpers.arrayElement(['nova', 'brno1', 'ostrava1'])
			},
			extra: null
		};
	}

	// =========================================================================
	// Backfill Project Mapping
	// =========================================================================

	private async backfillProjectMapping(generatedUsers: GeneratedUser[]): Promise<void> {
		this.logger.log('Backfilling project mapping...');

		for (const generated of generatedUsers) {
			// Backfill personal projects
			if (generated.personalProject) {
				const user = generated.user;
				const project = generated.personalProject;

				const identityConditions: string[] = [];
				const params: any[] = [project.id];

				if (user.externalId) {
					identityConditions.push(
						`EXISTS (SELECT 1 FROM jsonb_array_elements(identities) AS identity 
						 WHERE identity->>'scheme' = 'oidc_sub' AND identity->>'value' = $${params.length + 1})`
					);
					params.push(user.externalId);
				}

				if (user.username) {
					identityConditions.push(
						`EXISTS (SELECT 1 FROM jsonb_array_elements(identities) AS identity 
						 WHERE identity->>'scheme' = 'perun_username' AND identity->>'value' = $${params.length + 1})`
					);
					params.push(user.username);
				}

				if (identityConditions.length > 0) {
					const whereClause = `is_personal = true AND project_id IS NULL AND (${identityConditions.join(' OR ')})`;
					await this.dataSource.query(
						`UPDATE resource_usage_events SET project_id = $1 WHERE ${whereClause}`,
						params
					);
					await this.dataSource.query(
						`UPDATE resource_usage_daily_summaries SET project_id = $1 WHERE ${whereClause}`,
						params
					);
				}
			}

			// Backfill group projects
			for (const project of generated.groupProjects) {
				// Generate all possible prefixed slugs
				const possibleSlugs = CONFIG_CUSTOMER_KEYS.map((key) => `${key}-${project.projectSlug}`);
				possibleSlugs.push(project.projectSlug);

				await this.dataSource.query(
					`UPDATE resource_usage_events 
					 SET project_id = $1 
					 WHERE project_id IS NULL 
					 AND is_personal = false
					 AND project_slug = ANY($2)`,
					[project.id, possibleSlugs]
				);

				await this.dataSource.query(
					`UPDATE resource_usage_daily_summaries 
					 SET project_id = $1 
					 WHERE project_id IS NULL 
					 AND is_personal = false
					 AND project_slug = ANY($2)`,
					[project.id, possibleSlugs]
				);
			}
		}

		this.logger.log('Project mapping backfill complete');
	}

	// =========================================================================
	// Helper Methods
	// =========================================================================

	private printSummary(generatedUsers: GeneratedUser[]): void {
		this.logger.log('');
		this.logger.log('Generated Data Summary:');
		this.logger.log('-'.repeat(40));

		for (const generated of generatedUsers) {
			this.logger.log(`User: ${generated.user.username} (ID: ${generated.user.id})`);
			this.logger.log(`  External ID: ${generated.user.externalId}`);
			this.logger.log(`  Email: ${generated.user.email}`);

			if (generated.personalProject) {
				const pp = generated.personalProject;
				this.logger.log(`  Personal Project: ${pp.title} (ID: ${pp.id})`);
			}

			this.logger.log(`  Group Projects:`);
			for (const project of generated.groupProjects) {
				this.logger.log(`    - ${project.projectSlug} (ID: ${project.id})`);
			}
		}

		this.logger.log('');
		this.logger.log('To test, login as the test user and navigate to resource usage.');
		this.logger.log('You can also run aggregation to see daily summaries.');
	}

	private slugify(value: string): string {
		if (!value) return '';
		return value
			.normalize('NFKD')
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase();
	}

	private chunk<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}

	private async getOrCreateOpenstackResource(): Promise<Resource> {
		const resourceRepo = this.dataSource.getRepository(Resource);
		let resource = await resourceRepo.findOne({ where: { name: 'OpenStack' } });

		if (!resource) {
			const resourceTypeRepo = this.dataSource.getRepository(ResourceType);
			const resourceType = await resourceTypeRepo.findOne({ where: { name: 'OpenStack cloud' } });

			if (!resourceType) {
				throw new Error('OpenStack cloud resource type not found. Run seeders first.');
			}

			resource = resourceRepo.create({
				name: 'OpenStack',
				description: 'OpenStack cloud resources',
				isAvailable: true,
				resourceTypeId: resourceType.id
			});
			resource = await resourceRepo.save(resource);
		}

		return resource;
	}

	private async getOrCreatePbsResource(): Promise<Resource> {
		const resourceRepo = this.dataSource.getRepository(Resource);
		let resource = await resourceRepo.findOne({ where: { name: 'PBS' } });

		if (!resource) {
			const resourceTypeRepo = this.dataSource.getRepository(ResourceType);
			const resourceType = await resourceTypeRepo.findOne({ where: { name: 'Cluster' } });

			if (!resourceType) {
				throw new Error('Cluster resource type not found. Run seeders first.');
			}

			resource = resourceRepo.create({
				name: 'PBS',
				description: 'PBS compute resources',
				isAvailable: true,
				resourceTypeId: resourceType.id
			});
			resource = await resourceRepo.save(resource);
		}

		return resource;
	}

	private async getUserRole(): Promise<Role> {
		const roleRepo = this.dataSource.getRepository(Role);
		const role = await roleRepo.findOne({ where: { codeName: 'user' } });

		if (!role) {
			throw new Error('User role not found. Run seeders first.');
		}

		return role;
	}
}
