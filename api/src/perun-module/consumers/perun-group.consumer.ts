import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { Project } from 'resource-manager-database';
import { Logger } from '@nestjs/common';
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
	private readonly logger = new Logger(PerunGroupConsumer.name);

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
		this.logger.log(`Processing Perun group creation for project ${projectId}`);

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

			const lastStage = await this.failedStageModel.getLastStage(projectId);

			const pi = project.pi;

			// set group attributes
			currentStage = 'set_attributes';
			if (this.failedStageModel.shouldRunStage(currentStage, lastStage)) {
				this.logger.log('Setting Perun group attributes');
				await this.perunAttributesService.setAttribute(
					group.id,
					'urn:perun:group:attribute-def:def:fromEmail',
					pi.email
				);
				await this.perunAttributesService.setAttribute(group.id, 'urn:perun:group:attribute-def:def:toEmail', [
					pi.email
				]);
			}

			// find perun user
			this.logger.log(`Getting Perun user`);
			const richMembers = await this.perunMembersService.findCompleteRichMembers(pi.externalId);

			if (richMembers.length !== 1) {
				throw new Error('Should found exactly one member with specific externalId');
			}

			const perunUser = richMembers[0];

			// set PI as group manager
			currentStage = 'set_user';
			if (this.failedStageModel.shouldRunStage(currentStage, lastStage)) {
				this.logger.log(`Setting user with Perun ID ${perunUser.userId}`);
				await this.perunAuthzService.setRole('GROUPADMIN', perunUser.userId, group);
			}

			// copy application form
			currentStage = 'copy_form';
			if (this.failedStageModel.shouldRunStage(currentStage, lastStage)) {
				this.logger.log('Copying application form from template group');
				await this.perunRegistrarService.copyForm(group.id);
			}

			// copy mail templates
			currentStage = 'copy_mails';
			if (this.failedStageModel.shouldRunStage(currentStage, lastStage)) {
				this.logger.log('Copying notifications from template group');
				await this.perunRegistrarService.copyMails(group.id);
			}

			// everything successful, remove failed stage
			await this.failedStageModel.removeFailedStage(projectId);
		} catch (e) {
			// set that something failed
			await this.failedStageModel.setLastStage(projectId, currentStage);
			throw e;
		}

		this.logger.log(`Perun processing for project ${projectId} done.`);
	}
}
