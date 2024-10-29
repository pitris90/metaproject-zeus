import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GroupFailedStage } from 'resource-manager-database';

export type Stage = 'create_group' | 'set_attributes' | 'get_user';

@Injectable()
export class FailedStageModel {
	constructor(private readonly dataSource: DataSource) {}

	async getLastStage(projectId: number): Promise<Stage | null> {
		const row = await this.dataSource.getRepository(GroupFailedStage).findOne({
			where: {
				projectId
			}
		});

		if (!row) {
			return null;
		}

		return this.convertToStage(row.lastStage);
	}

	async removeFailedStage(projectId: number) {
		await this.dataSource.getRepository(GroupFailedStage).delete({
			projectId
		});
	}

	async setLastStage(stage: Stage) {
		await this.dataSource.getRepository(GroupFailedStage).insert({
			lastStage: stage
		});
	}

	private convertToStage(stage: string): Stage {
		switch (stage) {
			case 'create_group':
				return 'create_group';
			case 'set_attributes':
				return 'set_attributes';
			case 'get_user':
				return 'get_user';
			default:
				throw new Error('Unknown stage');
		}
	}
}
