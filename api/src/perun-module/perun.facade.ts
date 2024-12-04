import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Project } from 'resource-manager-database';
import { ProjectNotFoundApiException } from '../error-module/errors/projects/project-not-found.api-exception';
import { Group } from './entities/group.entity';
import { PerunGroupService } from './services/managers/perun-group.service';

@Injectable()
export class PerunFacade {
	constructor(
		private readonly dataSource: DataSource,
		private readonly perunGroupService: PerunGroupService,
		@InjectQueue('perunGroup') private readonly perunQueue: Queue,
		@InjectQueue('perunInvitations') private readonly perunInvitationQueue: Queue
	) {}

	async createGroup(projectId: number, title: string, description: string): Promise<Group> {
		const group = await this.perunGroupService.createGroup(title, description);
		await this.perunQueue.add('groupSettings', { group, projectId });

		return group;
	}

	async synchronize(projectId: number): Promise<void> {
		const project = await this.dataSource.getRepository(Project).findOne({
			where: {
				id: projectId
			}
		});

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		const group = await this.perunGroupService.getGroupById(project.perunId);
		await this.perunQueue.add('synchronize', { group, projectId });
	}

	async inviteMembers(userToken: string, emails: string[], projectId: number) {
		const project = await this.dataSource.getRepository(Project).findOne({
			where: {
				id: projectId
			}
		});

		if (!project) {
			throw new ProjectNotFoundApiException();
		}

		await this.perunInvitationQueue.add('invite', {
			userToken,
			emails,
			groupId: project.perunId,
			externalProjectId: project.perunId
		});
	}
}
