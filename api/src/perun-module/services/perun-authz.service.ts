import { Injectable } from '@nestjs/common';
import { PerunManager } from '../entities/manager.entity';
import { PerunApiService } from './perun-api.service';

@Injectable()
export class PerunAuthzService {
	constructor(private readonly perunApiService: PerunApiService) {}

	async setRole(role: string, userId: number, complementaryObject: any) {
		await this.perunApiService.callBasic(PerunManager.AUTHZ, 'setRole', {
			role,
			userId,
			complementaryObject
		});
	}
}
