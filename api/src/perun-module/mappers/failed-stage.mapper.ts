import { Injectable } from '@nestjs/common';
import { GroupFailedStage } from 'resource-manager-database';
import { FailedProjectDto } from '../dto/failed-project.dto';
import { ProjectJobStatusDto } from '../dto/project-job-status.dto';

@Injectable()
export class FailedStageMapper {
	toFailedProjectDto(failedStage: GroupFailedStage): FailedProjectDto {
		return {
			projectId: failedStage.projectId,
			lastStage: failedStage.lastStage,
			message: failedStage.message,
			updatedAt: failedStage.time.updatedAt,
			title: failedStage.project.title
		};
	}

	toProjectJobStatusDto(isRunning: boolean): ProjectJobStatusDto {
		return {
			isRunning
		};
	}
}
