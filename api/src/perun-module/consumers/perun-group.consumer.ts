import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { Project } from 'resource-manager-database';
import { Group } from '../entities/group.entity';
import { PerunAttributesService } from '../services/managers/perun-attributes.service';
import { PerunMembersService } from '../services/managers/perun-members.service';
import { PerunAuthzService } from '../services/managers/perun-authz.service';
import { FailedStageModel, Stage } from '../models/failed-stage.model';
import { PerunRegistrarService } from '../services/managers/perun-registrar.service';

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
		private readonly perunAuthzService: PerunAuthzService,
		private readonly perunRegistrarService: PerunRegistrarService,
		private readonly failedStageModel: FailedStageModel
	) {
		super();
	}

	async process(job: Job<JobData>) {
		let currentStage: Stage = 'create_group';
		const { group, projectId } = job.data;

		try {
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
			currentStage = 'set_attributes';
			await this.perunAttributesService.setAttribute(
				group.id,
				'urn:perun:group:attribute-def:def:fromEmail',
				pi.email
			);
			await this.perunAttributesService.setAttribute(
				group.id,
				'urn:perun:group:attribute-def:def:toEmail',
				pi.email
			);

			// find perun user
			currentStage = 'get_user';
			const richMembers = await this.perunMembersService.findCompleteRichMembers(pi.externalId);

			if (richMembers.length !== 1) {
				throw new Error('Should found exactly one member with specific externalId');
			}

			const perunUser = richMembers[0];

			// set PI as group manager
			currentStage = 'set_user';
			await this.perunAuthzService.setRole('GROUPADMIN', perunUser.userId, group);

			// copy application form
			currentStage = 'copy_form';
			await this.perunRegistrarService.copyForm(group.id);

			// copy mail templates
			currentStage = 'copy_mails';
			await this.perunRegistrarService.copyMails(group.id);

			// everything successful, remove failed stage
			await this.failedStageModel.removeFailedStage(projectId);
		} catch (e) {
			// set that something failed
			await this.failedStageModel.setLastStage(currentStage);
			throw e;
		}
	}
}
