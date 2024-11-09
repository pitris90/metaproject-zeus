import { Injectable } from '@nestjs/common';
import { FailedStageModel } from '../models/failed-stage.model';
import { FailedStageMapper } from '../mappers/failed-stage.mapper';

@Injectable()
export class FailedStageService {
	constructor(
		private readonly failedStageModel: FailedStageModel,
		private readonly failedStageMapper: FailedStageMapper
	) {}

	async getFailedProjects() {
		const failedStages = await this.failedStageModel.getFailedProjects();
		return failedStages.map((stage) => this.failedStageMapper.toFailedProjectDto(stage));
	}
}
