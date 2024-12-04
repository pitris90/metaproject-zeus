import { Body, Controller, Param, ParseFilePipeBuilder, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectDto } from '../dtos/project.dto';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { UserDto } from '../../users-module/dtos/user.dto';
import { ProjectArchiveDto } from '../dtos/input/project-archive.dto';
import { ProjectArchivalService } from '../services/project-archival.service';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { IsStepUp } from '../../auth-module/decorators/is-step-up.decorator';

@ApiTags('Project')
@Controller('/project')
export class ProjectArchiveController {
	constructor(private readonly projectArchivalService: ProjectArchivalService) {}

	@Post('/:id/archive')
	@MinRoleCheck(RoleEnum.ADMIN)
	@ApiOperation({
		summary: 'Archive project',
		description: 'Archive project request.'
	})
	@ApiOkResponse({
		description: 'The project was successfully archived.',
		type: ProjectDto
	})
	@ApiNotFoundResponse({
		description: 'Project does not exist.',
		type: ProjectNotFoundApiException
	})
	@ApiBody({
		type: ProjectArchiveDto,
		description: 'Information for archival of the project'
	})
	@UseInterceptors(FileInterceptor('file'))
	public async archiveProject(
		@RequestUser() user: UserDto,
		@UploadedFile(
			new ParseFilePipeBuilder().build({
				fileIsRequired: false
			})
		)
		file: Express.Multer.File,
		@Param('id') projectId: number,
		@Body() projectArchiveDto: ProjectArchiveDto,
		@IsStepUp() isStepUp: boolean
	): Promise<ProjectDto> {
		return this.projectArchivalService.archiveProject(user.id, projectId, projectArchiveDto, file, isStepUp);
	}
}
