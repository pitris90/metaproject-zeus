import { IsEmpty, IsNotEmpty, MinLength } from 'class-validator';

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
	 * The link to the project
	 *
	 * @example "https://is.muni.cz/project-link"
	 */
	@IsEmpty()
	link: string;

	/**
	 * The description of the project
	 *
	 * @example "This is a project description"
	 */
	@IsNotEmpty()
	@MinLength(15)
	description: string;
}
