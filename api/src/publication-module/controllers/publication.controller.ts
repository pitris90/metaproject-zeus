import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsCheck } from '../../permission-module/decorators/permissions.decorator';
import { PermissionEnum } from '../../permission-module/models/permission.enum';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { PublicationService } from '../services/publication.service';
import { PublicationRequestListDto } from '../dto/input/publication-input.dto';
import { PublicationListDto } from '../dto/publication-list.dto';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';
import { PublicationMapper } from '../mapper/publication.mapper';

@Controller('/publication')
@ApiTags('Publication')
export class PublicationController {
	constructor(
		private readonly publicationService: PublicationService,
		private readonly publicationMapper: PublicationMapper
	) {}

	@Get('/:projectId')
	@PermissionsCheck([PermissionEnum.MANIPULATE_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Get project publications',
		description: 'Get project publications. This method supports pagination.'
	})
	@ApiOkResponse({
		description: 'Publications of the project.',
		type: PublicationListDto
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async getProjectPublications(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting | null
	) {
		const [publications, count] = await this.publicationService.getProjectPublications(
			projectId,
			user.id,
			pagination,
			sorting
		);

		return {
			metadata: {
				page: pagination.page,
				recordsPerPage: publications.length,
				totalRecords: count
			},
			publications: publications.map((publication) =>
				this.publicationMapper.mapPublicationToPublicationDetailDto(publication)
			)
		};
	}

	@Delete('/:publicationId')
	@HttpCode(204)
	@PermissionsCheck([PermissionEnum.MANIPULATE_OWNED_PROJECTS])
	@ApiOperation({
		summary: 'Deletes publication from the project',
		description: 'Deletes publication from the project if user has correct permissions and access.'
	})
	@ApiNotFoundResponse({
		description: 'Publication with provided ID not found or user has no permission to access it.'
	})
	public async deletePublication(@Param('publicationId') publicationId: number, @RequestUser() user: UserDto) {
		await this.publicationService.deleteProjectPublication(publicationId, user.id);
	}

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
