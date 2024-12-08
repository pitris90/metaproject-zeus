import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerunApiService } from '../perun-api.service';
import { PerunManager } from '../../entities/manager.entity';
import { VO_ID } from '../../config/constants';
import { PerunApiException } from '../../exceptions/perun-api.exception';

const EXPIRATION_DAYS = 2;

@Injectable()
export class PerunInvitationsService {
	private readonly logger = new Logger(PerunInvitationsService.name);

	constructor(
		private readonly perunApiService: PerunApiService,
		private readonly configService: ConfigService
	) {}

	async inviteToGroup(
		token: string,
		groupId: number,
		receiverName: string,
		receiverEmail: string,
		language: string,
		externalProjectId: number
	) {
		const date = new Date();
		date.setDate(date.getDate() + EXPIRATION_DAYS);

		try {
			// TODO use oauth after reference token "Reference token could not be introspected" error is solved
			await this.perunApiService.callBasic(PerunManager.INVITATIONS, 'inviteToGroup', {
				vo: VO_ID,
				group: groupId,
				receiverName,
				receiverEmail,
				language,
				expiration: date.toISOString().split('T')[0],
				redirectUrl: `${this.configService.getOrThrow('FRONTEND_URL')}/project/invitation/${externalProjectId}`
			});
		} catch (e) {
			if (e instanceof PerunApiException) {
				this.logger.error(`${e.getName()} - ${e.getMessage()}`);
			}
		}
	}
}
