import { ProjectStatus, User } from 'resource-manager-database';
import { ProjectDto } from '../dtos/project.dto';

export class ProjectMapper {
	toProjectDto(id: number, title: string, description: string, status: ProjectStatus, pi: User): ProjectDto {
		return {
			id,
			title,
			description,
			status: status.toString(),
			user: {
				id: pi.id,
				source: pi.source,
				externalId: pi.externalId,
				username: pi.username
			}
		};
	}
}
