import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { Project } from 'resource-manager-database';
import { Logger } from '@nestjs/common';
import { Group } from '../entities/group.entity';
import { PerunAttributesService } from '../services/managers/perun-attributes.service';
import { PerunMembersService } from '../services/managers/perun-members.service';
import { PerunAuthzService } from '../services/managers/perun-authz.service';
import { PerunRegistrarService } from '../services/managers/perun-registrar.service';
import { FailedStageService, Stage } from '../services/failed-stage.service';

type JobData = {
	group: Group;
	projectId: number;
};

@Processor('perunGroup')
export class PerunGroupConsumer extends WorkerHost {
	private readonly logger = new Logger(PerunGroupConsumer.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly perunAttributesService: PerunAttributesService,
		private readonly perunMembersService: PerunMembersService,
		private readonly perunAuthzService: PerunAuthzService,
		private readonly perunRegistrarService: PerunRegistrarService,
		private readonly failedStageService: FailedStageService
	) {
		super();
	}

	async process(job: Job<JobData>) {
		this.logger.log(`Marking stage for project ${job.data.projectId} as running`);
		await this.failedStageService.setRunning(job.data.projectId, true);

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

			const lastStage = await this.failedStageService.getLastStage(projectId);

			// copy application form
			currentStage = 'copy_form';
			if (this.failedStageService.shouldRunStage(currentStage, lastStage)) {
				this.logger.log('Copying application form from template group');
				await this.perunRegistrarService.copyForm(group.id);
			}

			// copy mail templates
			currentStage = 'copy_mails';
			if (this.failedStageService.shouldRunStage(currentStage, lastStage)) {
				this.logger.log('Copying notifications from template group');
				await this.perunRegistrarService.copyMails(group.id);
			}

			const pi = project.pi;

			// set group attributes
			currentStage = 'set_attributes';
			if (this.failedStageService.shouldRunStage(currentStage, lastStage)) {
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
			const perunUser = await this.perunMembersService.findMemberByExternalId(pi.externalId);

			// set PI as group manager
			currentStage = 'set_user';
			if (this.failedStageService.shouldRunStage(currentStage, lastStage)) {
				this.logger.log(`Setting user with Perun ID ${perunUser.userId}`);
				await this.perunAuthzService.setRole('GROUPADMIN', perunUser.userId, group);
			}

			// everything successful, remove failed stage
			await this.failedStageService.removeFailedStage(projectId);
		} catch (e) {
			// set that something failed
			this.logger.warn(`Job for project ${projectId} failed.`);
			await this.failedStageService.setLastStage(projectId, currentStage, e?.message);
			throw e;
		} finally {
			this.logger.log(`Marking stage for project ${job.data.projectId} as not running`);
			await this.failedStageService.setRunning(job.data.projectId, false);
		}

		this.logger.log(`Perun processing for project ${projectId} done.`);
	}
}
