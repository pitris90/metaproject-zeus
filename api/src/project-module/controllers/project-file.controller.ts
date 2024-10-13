import { createReadStream } from 'fs';
import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { ProjectPermissionService } from '../services/project-permission.service';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { ProjectModel } from '../models/project.model';
import { ProjectInvalidResourceApiException } from '../../error-module/errors/projects/project-invalid-resource.api-exception';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';

@ApiTags('Project')
@Controller('/project')
export class ProjectFileController {
	public constructor(
		private readonly projectPermissionService: ProjectPermissionService,
		private readonly projectModel: ProjectModel
	) {}

	@Get(':id/file/archival')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Download archival attachment for specific project',
		description: 'Download file.'
	})
	@ApiOkResponse({
		description: 'File',
		type: StreamableFile
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this action.',
		type: ProjectNotFoundApiException
	})
	async getArchivalFile(
		@Res({ passthrough: true }) res: Response,
		@Param('id') id: number,
		@RequestUser() user: UserDto
	): Promise<StreamableFile> {
		const userPermissions = await this.projectPermissionService.getUserPermissions(id, user.id);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_ADVANCED_DETAILS)) {
			throw new ProjectNotFoundApiException();
		}

		const file = await this.projectModel.getArchivalInfo(id);

		if (!file) {
			throw new ProjectInvalidResourceApiException();
		}

		res.set({
			'Content-Type': file.reportFile.mime,
			'Content-Disposition': `attachment; filename=${file.reportFile.originalName}`
		});

		const readStream = createReadStream(file.reportFile.path);
		return new StreamableFile(readStream);
	}
}
