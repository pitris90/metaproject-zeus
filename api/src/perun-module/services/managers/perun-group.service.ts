import { Injectable } from '@nestjs/common';
import { PerunManager } from '../../entities/manager.entity';
import { PerunApiException } from '../../exceptions/perun-api.exception';
import { ProjectExistsApiException } from '../../../error-module/errors/projects/project-exists.api-exception';
import { Group } from '../../entities/group.entity';
import { VO_ID } from '../../config/constants';
import { PerunApiService } from '../perun-api.service';
import { ProjectNotFoundApiException } from '../../../error-module/errors/projects/project-not-found.api-exception';

@Injectable()
export class PerunGroupService {
	constructor(private readonly perunApiService: PerunApiService) {}

	async createGroup(title: string, description: string) {
		try {
			// Have to await, because exception won't be caught otherwise
			const result = await this.perunApiService.callBasic<Group>(PerunManager.GROUPS, 'createGroup', {
				vo: VO_ID,
				name: title,
				description: description
			});
			return result;
		} catch (e) {
			if (e instanceof PerunApiException) {
				if (e.getName() === 'GroupExistsException') {
					throw new ProjectExistsApiException();
				}
			}

			throw e;
		}
	}

	async getGroupById(id: number): Promise<Group> {
		try {
			const result = await this.perunApiService.callBasic<Group>(PerunManager.GROUPS, 'getGroupById', {
				id
			});
			return result;
		} catch (e) {
			if (e instanceof PerunApiException && e.getName() === 'GroupNotExistsException') {
				throw new ProjectNotFoundApiException();
			}

			throw e;
		}
	}
}
