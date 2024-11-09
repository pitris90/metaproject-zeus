import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { FailedStageService } from '../services/failed-stage.service';
import { FailedProjectDto } from '../dto/failed-project.dto';
import { PerunFacade } from '../perun.facade';

@Controller('project/failed-stages')
@ApiTags('Project')
export class PerunFailedGroupsController {
	constructor(
		private readonly failedStageService: FailedStageService,
		private readonly perunFacade: PerunFacade
	) {}

	@Get('/')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Get projects with failed Perun integration',
		description: 'Get all projects which have some error in them to allow re-run Perun integration'
	})
	@ApiOkResponse({
		description: 'Project with failed stages in Perun',
		type: [FailedProjectDto]
	})
	async getFailedStages() {
		return this.failedStageService.getFailedProjects();
	}

	@Post(':projectId')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Synchronize group',
		description:
			'Synchronize Perun group which belongs to project ID. This endpoint runs job on background. If you want to get status of update, you should periodically call detail endpoint.'
	})
	@ApiCreatedResponse({
		description: 'Created synchronize job'
	})
	async synchronizeGroup(@Param('projectId') projectId: number) {
		await this.perunFacade.synchronize(projectId);
	}
}
