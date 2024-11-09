import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GroupFailedStage } from 'resource-manager-database';

const stages = ['create_group', 'set_attributes', 'set_user', 'copy_form', 'copy_mails'] as const;
export type Stage = (typeof stages)[number];
const isStage = (x: any): x is Stage => stages.includes(x);

@Injectable()
export class FailedStageModel {
	constructor(private readonly dataSource: DataSource) {}

	async getFailedProjects(): Promise<GroupFailedStage[]> {
		return this.dataSource.getRepository(GroupFailedStage).find({
			relations: {
				project: true
			}
		});
	}

	async getLastStage(projectId: number): Promise<Stage | undefined> {
		const row = await this.dataSource.getRepository(GroupFailedStage).findOne({
			where: {
				projectId
			}
		});

		if (!row) {
			return undefined;
		}

		return this.convertToStage(row.lastStage);
	}

	shouldRunStage(currentStage: Stage, failedStage?: Stage) {
		if (failedStage === undefined) {
			return true;
		}

		return stages.indexOf(currentStage) >= stages.indexOf(failedStage);
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

	private convertToStage(stage: string): Stage {
		if (isStage(stage)) {
			return stage;
		}

		throw new Error('Unknown stage');
	}
}
