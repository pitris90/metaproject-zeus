import { Injectable } from '@nestjs/common';
import { PerunManager } from '../entities/manager.entity';
import { VO_ID } from '../config/constants';
import { RichMember } from '../entities/rich-member.entity';
import { PerunApiService } from './perun-api.service';

@Injectable()
export class PerunMembersService {
	constructor(private readonly perunApiService: PerunApiService) {}

	async findCompleteRichMembers(searchString: string) {
		return this.perunApiService.callBasic<RichMember[]>(PerunManager.MEMBERS, 'findCompleteRichMembers', {
			vo: VO_ID,
			attrsNames: [],
			searchString
		});
	}
}
