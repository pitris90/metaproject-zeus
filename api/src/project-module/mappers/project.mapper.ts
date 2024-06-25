import { Project, ProjectStatus } from 'resource-manager-database';
import { Injectable } from '@nestjs/common';
import { ProjectDto } from '../dtos/project.dto';
import { UserMapper } from '../../users-module/services/user.mapper';

@Injectable()
export class ProjectMapper {
	constructor(private readonly userMapper: UserMapper) {}

	toProjectDto(project: Project): ProjectDto {
		return {
			id: project.id,
			title: project.title,
			description: project.description,
			status: this.fromProjectStatus(project.status),
			user: this.userMapper.toUserDto(project.pi),
			createdAt: project.time.createdAt
		};
	}

	public fromProjectStatus(status: ProjectStatus): 'new' | 'active' | 'rejected' | 'archived' {
		switch (status) {
			case ProjectStatus.NEW:
				return 'new';
			case ProjectStatus.ACTIVE:
				return 'active';
			case ProjectStatus.REJECTED:
				return 'rejected';
			case ProjectStatus.ARCHIVED:
				return 'archived';
			default:
				throw new Error('Invalid project status');
		}
	}

	public toProjectStatus(status: string | null): ProjectStatus | null {
		switch (status) {
			case 'new':
				return ProjectStatus.NEW;
			case 'active':
				return ProjectStatus.ACTIVE;
			case 'rejected':
				return ProjectStatus.REJECTED;
			case 'archived':
				return ProjectStatus.ARCHIVED;
			default:
				return null;
		}
	}
}
