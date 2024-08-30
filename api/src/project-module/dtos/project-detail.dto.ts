import { ProjectPermissionEnum } from '../enums/project-permission.enum';
import { ProjectDto } from './project.dto';
import { ProjectFileDto } from './project-file.dto';

export class ArchivalInfoDto {
	/**
	 * Project archival reason.
	 *
	 * @example "Project has ended."
	 */
	description: string;

	/**
	 * File appended to project archival
	 */
	file?: ProjectFileDto;

	/**
	 * Project archival date. ISO format.
	 */
	archivedAt: string;
}

export class RejectedCommentDto {
	/**
	 * Comment text
	 */
	comment: string;

	/**
	 * Comment author
	 */
	author: string;

	/**
	 * Review created at
	 */
	createdAt: string;
}

export class ProjectDetailDto {
	/**
	 * Project details
	 */
	project: ProjectDto;

	/**
	 * Permissions for logged member
	 */
	permissions: ProjectPermissionEnum[];

	/**
	 * The project's archival info (if project is archived and user has permissions.)
	 */
	archivalInfo?: ArchivalInfoDto;

	/**
	 * Rejected comments (if project is rejected if the project is rejected and user has permissions)
	 */
	rejectedComments?: RejectedCommentDto[];
}
