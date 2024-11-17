import { Injectable } from '@nestjs/common';
import { PerunManager } from '../../entities/manager.entity';
import { PerunAttribute } from '../../entities/perun-attribute.entity';
import { PerunApiService } from '../perun-api.service';

@Injectable()
export class PerunAttributesService {
	constructor(private readonly perunApiService: PerunApiService) {}

	async getAttribute(groupId: number, key: string) {
		return this.perunApiService.callBasic<PerunAttribute>(PerunManager.ATTRIBUTES, 'getAttribute', {
			group: groupId,
			attributeName: key
		});
	}

	async getAttributes(groupId: number) {
		return this.perunApiService.callBasic<PerunAttribute[]>(PerunManager.ATTRIBUTES, 'getAttributes', {
			group: groupId
		});
	}

	async setAttribute(groupId: number, key: string, value: any) {
		const attributeTemplate = await this.getAttribute(groupId, key);
		attributeTemplate.value = value;

		return this.perunApiService.callBasic(PerunManager.ATTRIBUTES, 'setAttribute', {
			group: groupId,
			attribute: attributeTemplate
		});
	}
}
