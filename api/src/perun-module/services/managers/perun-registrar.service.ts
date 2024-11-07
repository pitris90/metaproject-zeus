import { Injectable } from '@nestjs/common';
import { PerunApiService } from '../perun-api.service';
import { PerunManager } from '../../entities/manager.entity';
import { TEMPLATE_GROUP_ID } from '../../config/constants';

@Injectable()
export class PerunRegistrarService {
	constructor(private readonly perunApiService: PerunApiService) {}

	async copyForm(toGroupId: number) {
		await this.perunApiService.callBasic(PerunManager.REGISTRAR, 'copyForm', {
			fromGroup: TEMPLATE_GROUP_ID,
			toGroup: toGroupId
		});
	}

	async copyMails(toGroupId: number) {
		await this.perunApiService.callBasic(PerunManager.REGISTRAR, 'copyMails', {
			fromGroup: TEMPLATE_GROUP_ID,
			toGroup: toGroupId
		});
	}
}
