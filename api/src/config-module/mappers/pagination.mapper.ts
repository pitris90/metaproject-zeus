import { Injectable } from '@nestjs/common';
import { PaginatedResultDto } from '../dtos/paginated-result.dto';
import { PaginationInputDto } from '../dtos/input/pagination-input.dto';

@Injectable()
export class PaginationMapper {
	toPaginatedResult<T>(pagination: PaginationInputDto, totalCount: number, items: T[]): PaginatedResultDto<T> {
		return {
			metadata: {
				page: pagination.page,
				recordsPerPage: pagination.limit,
				totalRecords: totalCount
			},
			data: items
		};
	}
}
