import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
	Allocation,
	AllocationStatus,
	AllocationUser,
	Project,
	ProjectStatus,
	ProjectUser,
	ProjectUserRole,
	ProjectUserStatus,
	Publication,
	Resource,
	User
} from 'resource-manager-database';

@Injectable()
export class FakeDataService {
	private readonly logger = new Logger(FakeDataService.name);

	constructor(private readonly dataSource: DataSource) {}

	async generate(count: number) {
		const resources = await this.dataSource.getRepository(Resource).find();
		const resourceIds = resources.map((resource) => resource.id);

		// first create count users
		this.logger.log(`Creating ${count} users`);
		const usersData = Array.from({ length: count }, () => this.createRandomUser());
		const users = await this.dataSource.getRepository(User).insert(usersData);
		const userIds = users.identifiers.map((user) => user['id']);

		// then pick PI for projects (only 1/10 of users should be PI)
		const piUserIds = userIds.filter((_, index) => index % 10 === 0);
		this.logger.log(`Choosing ${piUserIds.length} PI users`);

		// then create count projects
		this.logger.log(`Creating ${count} projects`);
		const projectData = Array.from({ length: count }, (_, index) => {
			const piId = piUserIds[index % 10] > piUserIds.length ? piUserIds[0] : piUserIds[index % 10];
			return this.createRandomProject(piId);
		});
		const projects = await this.dataSource.getRepository(Project).insert(projectData);
		const projectIds = projects.identifiers.map((project) => project['id']);

		const normalUserIds = userIds.filter((userId) => !piUserIds.includes(userId));

		// add info to each project
		this.logger.log(`Adding data to ${count} projects`);
		for (let i = 0; i < projectIds.length; i++) {
			const projectId = projectIds[i];

			// add members to project
			const randomMemberIds = [...normalUserIds].sort(() => Math.random() - 0.5).slice(0, 10);
			const memberData = randomMemberIds.map((userId) => this.createRandomMember(projectId, userId));
			await this.dataSource.getRepository(ProjectUser).insert(memberData);

			// add publication to project
			const publicationData = Array.from({ length: 5 }, () => this.createRandomPublication(projectId));
			await this.dataSource.getRepository(Publication).insert(publicationData);

			const eligibleUsers = [...randomMemberIds, piUserIds[i]];

			// add random allocations to project
			const allocationData = eligibleUsers.map(() => this.createRandomAllocation(projectId, resourceIds));
			const allocations = await this.dataSource.getRepository(Allocation).insert(allocationData);
			const allocationIds = allocations.identifiers.map((allocation) => allocation['id']);

			// add members to allocations
			const allocationMemberData = allocationIds.map((allocationId) =>
				this.createRandomAllocationUser(allocationId, eligibleUsers)
			);
			await this.dataSource.getRepository(AllocationUser).insert(allocationMemberData);
			this.logger.log(`--- Added data to project ${projectId}`);
		}
		this.logger.log('Done');
	}

	private createRandomUser() {
		return {
			source: 'perun',
			externalId: faker.string.uuid(),
			email: faker.internet.email(),
			emailVerified: true,
			username: faker.internet.username(),
			name: faker.internet.displayName(),
			roleId: 1
		};
	}

	private createRandomProject(userId: number) {
		return {
			title: faker.lorem.words(3),
			description: faker.lorem.paragraph(),
			link: faker.internet.url(),
			status: ProjectStatus.ACTIVE,
			piId: userId
		};
	}

	private createRandomPublication(projectId: number) {
		return {
			title: faker.lorem.words(3),
			author: faker.internet.displayName(),
			year: faker.number.int({
				min: 2000,
				max: 2021
			}),
			uniqueId: faker.string.uuid(),
			journal: faker.lorem.words(1),
			source: 'manual' as const,
			projectId
		};
	}

	private createRandomMember(projectId: number, userId: number) {
		return {
			projectId: projectId,
			userId: userId,
			role: Math.random() > 0.5 ? ProjectUserRole.USER : ProjectUserRole.MANAGER,
			status: ProjectUserStatus.ACTIVE
		};
	}

	private createRandomAllocation(projectId: number, resourceIds: number[]) {
		return {
			justification: faker.lorem.lines(1),
			description: faker.lorem.paragraph(),
			projectId: projectId,
			quantity: faker.number.int({
				min: 1,
				max: 100
			}),
			resourceId: faker.helpers.arrayElement(resourceIds),
			status: faker.helpers.enumValue(AllocationStatus),
			startDate: faker.date.past(),
			endDate: faker.date.future(),
			isLocked: faker.datatype.boolean(),
			isChangeable: faker.datatype.boolean()
		};
	}

	private createRandomAllocationUser(allocationId: number, userIds: number[]) {
		return {
			allocationId,
			userId: faker.helpers.arrayElement(userIds),
			status: faker.helpers.enumValue(AllocationStatus)
		};
	}
}
