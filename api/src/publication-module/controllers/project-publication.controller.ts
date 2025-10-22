import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { PublicationService } from '../services/publication.service';
import { PublicationListDto } from '../dto/publication-list.dto';
import { PublicationMapper } from '../mapper/publication.mapper';
import { PaginationMapper } from '../../config-module/mappers/pagination.mapper';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';
import { PublicationRequestListDto } from '../dto/input/publication-input.dto';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { IsStepUp } from '../../auth-module/decorators/is-step-up.decorator';

@Controller('projects/:projectId/publications')
@ApiTags('Project Publications')
export class ProjectPublicationController {
	constructor(
		private readonly publicationService: PublicationService,
		private readonly publicationMapper: PublicationMapper,
		private readonly paginationMapper: PaginationMapper
	) {}

	@Get()
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'List publications assigned to project' })
	@ApiOkResponse({ description: 'Project publications.', type: PublicationListDto })
	async list(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting | null,
		@IsStepUp() isStepUp: boolean
	) {
		const [publications, count] = await this.publicationService.getProjectPublications(
			projectId,
			user.id,
			pagination,
			sorting,
			isStepUp
		);

		const items = publications.map((publication) =>
			this.publicationMapper.mapPublicationToPublicationDetailDto(publication, user.id)
		);
		return this.paginationMapper.toPaginatedResult(pagination, count, items);
	}

	@Post()
	@HttpCode(201)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'Add publications to project (bulk)' })
	@ApiCreatedResponse({ description: 'Publications linked to project.' })
	async add(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@Body() body: PublicationRequestListDto,
		@IsStepUp() isStepUp: boolean
	) {
		await this.publicationService.addPublicationToProject(user.id, projectId, body.publications, isStepUp);
	}

	@Delete('/:publicationId')
	@HttpCode(204)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'Unassign publication from project' })
	@ApiNotFoundResponse({ description: 'Publication not linked to this project or not accessible.' })
	async remove(
		@Param('projectId') projectId: number,
		@Param('publicationId') publicationId: number,
		@RequestUser() user: UserDto,
		@IsStepUp() isStepUp: boolean
	) {
		await this.publicationService.deleteProjectPublicationFromProject(projectId, publicationId, user.id, isStepUp);
	}
}
