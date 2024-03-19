export class ProjectRejectDto {
	/**
	 * ID of the project to reject
	 *
	 * @example 1
	 */
	projectId: number;
	/**
	 * Reason for rejecting the project
	 *
	 * @example "Project is not feasible"
	 */
	reason: string;
}
