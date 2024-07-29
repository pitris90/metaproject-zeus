import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { PublicationService } from '../services/publication.service';
import { PublicationRequestListDto } from '../dto/input/publication-input.dto';

@Controller('/publication')
@ApiTags('Publication')
export class PublicationController {
	constructor(private readonly publicationService: PublicationService) {}

	@Post('/:projectId')
	@HttpCode(201)
	@PermissionsCheck([PermissionEnum.MANIPULATE_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Add publications to project',
		description: 'Adds publications to project. This is bulk endpoint, either all publications are added or none.'
	})
	@ApiCreatedResponse({
		description: 'Publications added to project.'
	})
	public async getPublicationByDoi(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@Body() publicationsBody: PublicationRequestListDto
	) {
		await this.publicationService.addPublicationToProject(user.id, projectId, publicationsBody.publications);
	}
}
