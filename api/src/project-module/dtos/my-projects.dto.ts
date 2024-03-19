import { ProjectDto } from './project.dto';

export class MyProjectsDto {
	/**
	 * User projects matching chosen criteria
	 */
	projects: ProjectDto[];
}
