import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../users-module/dtos/user.dto';

export class ProjectDto {
	/**
	 * The project's id
	 *
	 * @example 1
	 */
	id: number;
	/**
	 * The project's title
	 *
	 * @example "My project"
	 */
	title: string;
	/**
	 * The project's description
	 *
	 * @example "This is a project description"
	 */
	description: string;
	/**
	 * The project's status
	 *
	 * @example "new"
	 */
	status: 'new' | 'active' | 'inactive';

	/**
	 * The project's creation date. ISO format.
	 */
	createdAt: string;

	@ApiProperty({ type: UserDto, description: 'The user who created the project' })
	user: UserDto;
}
