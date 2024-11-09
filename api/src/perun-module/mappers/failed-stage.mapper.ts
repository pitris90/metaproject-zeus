import { Injectable } from '@nestjs/common';
import { GroupFailedStage } from 'resource-manager-database';
import { FailedProjectDto } from '../dto/failed-project.dto';

@Injectable()
export class FailedStageMapper {
	toFailedProjectDto(failedStage: GroupFailedStage): FailedProjectDto {
		return {
			projectId: failedStage.projectId,
			lastStage: failedStage.lastStage,
			updatedAt: failedStage.time.updatedAt,
			title: failedStage.project.title
		};
	}
}
