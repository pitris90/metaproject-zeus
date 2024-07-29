import { PaginationDto } from '../../config-module/dtos/pagination.dto';
import { PublicationDto } from './publication.dto';

export class PublicationListDto {
	/**
	 * Metadata for pagination.
	 */
	metadata: PaginationDto;

	/**
	 * Publications of the project.
	 */
	publications: PublicationDto[];
}
