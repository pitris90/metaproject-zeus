import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { ProjectDto } from './project.dto';

export class ProjectDetailDto {
	/**
	 * Project details
	 */
	project: ProjectDto;

	/**
	 * Permissions for logged member
	 */
	permissions: ProjectPermissionEnum[];
}
