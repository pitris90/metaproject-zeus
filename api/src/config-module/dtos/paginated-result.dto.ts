import { PaginationDto } from './pagination.dto';

export class PaginatedResultDto<T> {
	/**
	 * Metadata about pagination
	 */
	metadata: PaginationDto;

	/**
	 * Item list
	 */
	data: T[];
}
