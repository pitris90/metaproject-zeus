import { PaginationDto } from '../../config-module/dtos/pagination.dto';
import { ProjectDto } from './project.dto';

export class MyProjectsDto {
	metadata: PaginationDto;
	/**
	 * User projects matching chosen criteria
	 */
	data: ProjectDto[];
}
