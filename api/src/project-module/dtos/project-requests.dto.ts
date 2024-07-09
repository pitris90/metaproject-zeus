import { PaginationDto } from '../../config-module/dtos/pagination.dto';
import { ProjectDto } from './project.dto';

export class ProjectRequestsDto {
	metadata: PaginationDto;
	/**
	 * User projects matching chosen criteria
	 */
	projects: ProjectDto[];
}
