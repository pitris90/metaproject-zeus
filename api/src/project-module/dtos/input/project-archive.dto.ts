import { IsNotEmpty, MinLength } from 'class-validator';

export class ProjectArchiveDto {
	/**
	 * Justification for archiving project
	 *
	 * @example "Project has ended"
	 */
	@IsNotEmpty()
	@MinLength(10)
	message: string;
}
