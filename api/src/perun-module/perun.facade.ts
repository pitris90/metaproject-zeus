import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PerunGroupService } from './services/managers/perun-group.service';
import { Group } from './entities/group.entity';

@Injectable()
export class PerunFacade {
	constructor(
		private readonly perunGroupService: PerunGroupService,
		@InjectQueue('perun') private readonly perunQueue: Queue
	) {}

	async createGroup(projectId: number, title: string, description: string): Promise<Group> {
		const group = await this.perunGroupService.createGroup(title, description);
		await this.perunQueue.add('groupSettings', { group, projectId });

		return group;
	}
}
