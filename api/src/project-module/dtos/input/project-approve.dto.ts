import { IsNotEmpty, IsNumber } from 'class-validator';

export class ProjectApproveDto {
	/**
	 * ID of the project to approve
	 *
	 * @example 1
	 */
	@IsNotEmpty()
	@IsNumber()
	projectId: number;
}
