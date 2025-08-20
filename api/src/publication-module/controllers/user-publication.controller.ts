import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { PublicationService } from '../services/publication.service';
import { GetPagination, Pagination } from '../../config-module/decorators/get-pagination';
import { GetSorting, Sorting } from '../../config-module/decorators/get-sorting';
import { PublicationListDto } from '../dto/publication-list.dto';
import { PublicationMapper } from '../mapper/publication.mapper';
import { PaginationMapper } from '../../config-module/mappers/pagination.mapper';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { CreateOwnedPublicationDto, AssignPublicationDto } from '../dto/input/publication-assign.dto';
import { IsStepUp } from '../../auth-module/decorators/is-step-up.decorator';

@Controller('/my/publications')
@ApiTags('My Publications')
export class UserPublicationController {
	constructor(
		private readonly publicationService: PublicationService,
		private readonly paginationMapper: PaginationMapper,
		private readonly publicationMapper: PublicationMapper
	) {}

	@Get()
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'List my publications', description: 'List publications owned by current user.' })
	@ApiOkResponse({ description: 'Your publications.', type: PublicationListDto })
	async listMine(
		@RequestUser() user: UserDto,
		@GetPagination() pagination: Pagination,
		@GetSorting() sorting: Sorting | null
	) {
		const [publications, count] = await this.publicationService.getUserPublications(user.id, pagination, sorting);
		const items = publications.map((p) => this.publicationMapper.mapPublicationToPublicationDetailDto(p));
		return this.paginationMapper.toPaginatedResult(pagination, count, items);
	}

	@Post()
	@HttpCode(201)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'Create my publication' })
	@ApiCreatedResponse({ description: 'Publication created.' })
	async createMine(@RequestUser() user: UserDto, @Body() body: CreateOwnedPublicationDto) {
		await this.publicationService.createOwnedPublication(user.id, body);
	}

	@Post('/:id/assign')
	@HttpCode(200)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'Assign my publication to a project' })
	async assign(
		@Param('id') id: number,
		@RequestUser() user: UserDto,
		@Body() body: AssignPublicationDto,
		@IsStepUp() isStepUp: boolean
	) {
		await this.publicationService.assignOwnedPublication(user.id, id, body, isStepUp);
	}

	@Delete('/:id')
	@HttpCode(204)
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({ summary: 'Delete my publication permanently' })
	async deleteMine(@Param('id') id: number, @RequestUser() user: UserDto) {
		await this.publicationService.deleteOwnedPublication(id, user.id);
	}
}
