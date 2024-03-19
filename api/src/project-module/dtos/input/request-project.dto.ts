import { IsNotEmpty, MinLength } from 'class-validator';

export class RequestProjectDto {
	/**
	 * The title of the project
	 *
	 * @example "My project"
	 */
	@IsNotEmpty()
	@MinLength(5)
	title: string;

	/**
	 * The description of the project
	 *
	 * @example "This is a project description"
	 */
	@IsNotEmpty()
	@MinLength(15)
	description: string;
}
