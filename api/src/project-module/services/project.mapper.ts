import { Project, ProjectStatus } from 'resource-manager-database';
import { ProjectDto } from '../dtos/project.dto';

export class ProjectMapper {
	toProjectDto(project: Project): ProjectDto {
		return {
			id: project.id,
			title: project.title,
			description: project.description,
			status: this.fromProjectStatus(project.status),
			user: {
				id: project.pi.id,
				source: project.pi.source,
				externalId: project.pi.externalId,
				username: project.pi.username
			}
		};
	}

	public fromProjectStatus(status: ProjectStatus): 'new' | 'active' | 'inactive' {
		switch (status) {
			case ProjectStatus.NEW:
				return 'new';
			case ProjectStatus.ACTIVE:
				return 'active';
			case ProjectStatus.INACTIVE:
				return 'inactive';
		}
	}

	public toProjectStatus(status: string | null): ProjectStatus | null {
		switch (status) {
			case 'new':
				return ProjectStatus.NEW;
			case 'active':
				return ProjectStatus.ACTIVE;
			case 'inactive':
				return ProjectStatus.INACTIVE;
			default:
				return null;
		}
	}
}
