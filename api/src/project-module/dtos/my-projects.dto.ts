import { PaginationDto } from '../../config-module/dtos/pagination.dto';
import { ProjectDto } from './project.dto';

export class ProjectsDto {
	metadata: PaginationDto;
	/**
	 * User projects matching chosen criteria
	 */
	data: ProjectDto[];
}
