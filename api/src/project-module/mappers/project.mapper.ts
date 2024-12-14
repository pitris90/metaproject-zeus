import { Project, ProjectApproval, ProjectArchival, ProjectStatus } from 'resource-manager-database';
import { Injectable } from '@nestjs/common';
import { ProjectDto } from '../dtos/project.dto';
import { UserMapper } from '../../users-module/services/user.mapper';
import { ArchivalInfoDto, ProjectDetailDto, RejectedCommentDto } from '../dtos/project-detail.dto';
import { ProjectPermissionEnum } from '../enums/project-permission.enum';

@Injectable()
export class ProjectMapper {
	constructor(private readonly userMapper: UserMapper) {}

	toProjectDto(project: Project): ProjectDto {
		return {
			id: project.id,
			title: project.title,
			link: project.link,
			description: project.description,
			status: this.fromProjectStatus(project.status),
			user: this.userMapper.toUserDto(project.pi),
			createdAt: project.createdAt
		};
	}

	toProjectDetailDto(
		project: Project,
		permissions: Set<ProjectPermissionEnum>,
		archivalInfo: ProjectArchival | null,
		rejectedComments: ProjectApproval[] | null
	): ProjectDetailDto {
		return {
			project: this.toProjectDto(project),
			permissions: [...permissions],
			archivalInfo: archivalInfo ? this.getProjectArchivalInfo(archivalInfo) : undefined,
			rejectedComments: rejectedComments !== null ? this.getRejectedComments(rejectedComments) : undefined
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

	private getRejectedComments(rejectedComments: ProjectApproval[]): RejectedCommentDto[] {
		return rejectedComments.flatMap((comment) => {
			if (!comment.description) {
				return [];
			}

			return {
				comment: comment.description,
				author: comment.reviewer.name,
				createdAt: comment.time.createdAt
			};
		});
	}

	private getProjectArchivalInfo(archivalInfo: ProjectArchival): ArchivalInfoDto {
		return {
			description: archivalInfo.description,
			archivedAt: archivalInfo.time.createdAt,
			file: archivalInfo.reportFile
				? {
						id: archivalInfo.reportFile.id,
						name: archivalInfo.reportFile.originalName,
						size: archivalInfo.reportFile.size,
						mime: archivalInfo.reportFile.mime,
						createdAt: archivalInfo.reportFile.time.createdAt
					}
				: undefined
		};
	}
}
