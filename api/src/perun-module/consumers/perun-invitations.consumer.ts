import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PerunInvitationsService } from '../services/managers/perun-invitations.service';

type JobData = {
	userToken: string;
	groupId: number;
	emails: string[];
	externalProjectId: number;
};

@Processor('perunInvitations')
export class PerunInvitationsConsumer extends WorkerHost {
	private readonly logger = new Logger(PerunInvitationsConsumer.name);

	constructor(private readonly perunInvitationsService: PerunInvitationsService) {
		super();
	}

	async process(job: Job<JobData>) {
		const { userToken, emails, groupId, externalProjectId } = job.data;
		this.logger.log(`Starting to send invitations for group ${groupId}`);

		for (const email of emails) {
			this.logger.log(`Sending invitation to mail ${email}`);
			await this.perunInvitationsService.inviteToGroup(userToken, groupId, email, email, 'cs', externalProjectId);
		}
	}
}
