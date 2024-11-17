import { PaginationDto } from '../../config-module/dtos/pagination.dto';
import { MemberDto } from './member.dto';

export class MemberListDto {
	/**
	 * Metadata for pagination.
	 */
	metadata: PaginationDto;

	/**
	 * Members of the project.
	 */
	data: MemberDto[];
}
