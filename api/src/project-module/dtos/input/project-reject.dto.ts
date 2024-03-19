import { IsNotEmpty, IsNumber, MinLength } from 'class-validator';

export class ProjectRejectDto {
	/**
	 * ID of the project to reject
	 *
	 * @example 1
	 */
	@IsNotEmpty()
	@IsNumber()
	projectId: number;
	/**
	 * Reason for rejecting the project
	 *
	 * @example "Project is not feasible"
	 */
	@IsNotEmpty()
	@MinLength(10)
	reason: string;
}
