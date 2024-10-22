import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicationDto } from '../dto/publication.dto';
import { PublicationNotFoundApiException } from '../../error-module/errors/publications/publication-not-found.api-exception';
import { Public } from '../../auth-module/decorators/public.decorator';
import { ApiPublicationService } from '../services/api-publication.service';

@Controller('/publication-search')
@ApiTags('Publication')
export class PublicationSearchController {
	constructor(private readonly apiPublicationService: ApiPublicationService) {}

	@Get('/doi/:doi')
	@Public()
	@ApiOperation({
		summary: 'Get publication by DOI.',
		description: 'Get publication by DOI.'
	})
	@ApiOkResponse({
		description: 'Publication.',
		type: PublicationDto
	})
	@ApiNotFoundResponse({
		description: 'Publication with DOI not found.',
		type: PublicationNotFoundApiException
	})
	public async getPublicationByDoi(@Param('doi') doi: string) {
		return this.apiPublicationService.getPublicationByDoi(doi);
	}
}
