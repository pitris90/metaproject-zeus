import { Injectable } from '@nestjs/common';
import { FailedStageModel } from '../models/failed-stage.model';
import { FailedStageMapper } from '../mappers/failed-stage.mapper';

const stages = ['create_group', 'set_attributes', 'set_user', 'copy_form', 'copy_mails'] as const;
export type Stage = (typeof stages)[number];
const isStage = (x: any): x is Stage => stages.includes(x);

@Injectable()
export class FailedStageService {
	constructor(
		private readonly failedStageModel: FailedStageModel,
		private readonly failedStageMapper: FailedStageMapper
	) {}

	async getFailedProjects() {
		const failedStages = await this.failedStageModel.getAll();
		return failedStages.map((stage) => this.failedStageMapper.toFailedProjectDto(stage));
	}

	async getLastStage(projectId: number): Promise<Stage | undefined> {
		const row = await this.failedStageModel.getByProjectId(projectId);

		if (!row) {
			return undefined;
		}

		return this.convertToStage(row.lastStage);
	}

	async setRunning(projectId: number, isRunning: boolean) {
		await this.failedStageModel.setRunning(projectId, isRunning);
	}

	shouldRunStage(currentStage: Stage, failedStage?: Stage) {
		if (failedStage === undefined) {
			return true;
		}

		return stages.indexOf(currentStage) >= stages.indexOf(failedStage);
	}

	async removeFailedStage(projectId: number) {
		await this.failedStageModel.removeFailedStage(projectId);
	}

	async setLastStage(projectId: number, stage: Stage) {
		await this.failedStageModel.setLastStage(projectId, stage);
	}

	async isJobRunning(projectId: number) {
		const failedStage = await this.failedStageModel.getByProjectId(projectId);

		if (!failedStage) {
			return this.failedStageMapper.toProjectJobStatusDto(false);
		}

		return this.failedStageMapper.toProjectJobStatusDto(failedStage.isRunning);
	}

	private convertToStage(stage: string): Stage {
		if (isStage(stage)) {
			return stage;
		}

		throw new Error('Unknown stage');
	}
}
