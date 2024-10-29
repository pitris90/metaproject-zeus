import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { Project } from 'resource-manager-database';
import { Group } from '../entities/group.entity';
import { PerunAttributesService } from '../services/perun-attributes.service';
import { PerunMembersService } from '../services/perun-members.service';
import { PerunAuthzService } from '../services/perun-authz.service';

type JobData = {
	group: Group;
	projectId: number;
};

@Processor('perun')
export class PerunGroupConsumer extends WorkerHost {
	constructor(
		private readonly dataSource: DataSource,
		private readonly perunAttributesService: PerunAttributesService,
		private readonly perunMembersService: PerunMembersService,
		private readonly perunAuthzService: PerunAuthzService
	) {
		super();
	}

	async process(job: Job<JobData>) {
		const { group, projectId } = job.data;
		const project = await this.dataSource.getRepository(Project).findOne({
			where: {
				id: projectId
			},
			relations: {
				pi: true
			}
		});

		if (!project) {
			throw new Error('Project not found, should not happen');
		}

		const pi = project.pi;

		// set group attributes
		await this.perunAttributesService.setAttribute(
			group.id,
			'urn:perun:group:attribute-def:def:fromEmail',
			pi.email
		);
		await this.perunAttributesService.setAttribute(group.id, 'urn:perun:group:attribute-def:def:toEmail', pi.email);

		// find perun user
		const richMembers = await this.perunMembersService.findCompleteRichMembers(pi.externalId);

		if (richMembers.length !== 1) {
			throw new Error('Should found exactly one member with specific externalId');
		}

		const perunUser = richMembers[0];

		// set PI as group manager
		await this.perunAuthzService.setRole('GROUPADMIN', perunUser.userId, group);
	}
}
