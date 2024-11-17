import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GroupFailedStage } from 'resource-manager-database';
import { Stage } from '../services/failed-stage.service';

@Injectable()
export class FailedStageModel {
	constructor(private readonly dataSource: DataSource) {}

	async getAll(): Promise<GroupFailedStage[]> {
		return this.dataSource.getRepository(GroupFailedStage).find({
			relations: {
				project: true
			}
		});
	}

	async getByProjectId(projectId: number) {
		return this.dataSource.getRepository(GroupFailedStage).findOne({
			where: {
				projectId
			}
		});
	}

	async removeFailedStage(projectId: number) {
		await this.dataSource.getRepository(GroupFailedStage).delete({
			projectId
		});
	}

	async setLastStage(projectId: number, stage: Stage) {
		await this.dataSource.getRepository(GroupFailedStage).upsert(
			{
				projectId: projectId,
				lastStage: stage
			},
			['projectId']
		);
	}

	async setRunning(projectId: number, isRunning: boolean) {
		await this.dataSource.getRepository(GroupFailedStage).update(
			{
				projectId
			},
			{
				isRunning
			}
		);
	}
}
