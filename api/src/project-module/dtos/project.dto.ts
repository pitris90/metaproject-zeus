import { UserDto } from '../../users-module/dtos/user.dto';

export type ProjectDto = {
	id: number;
	title: string;
	description: string;
	status: string;
	user: UserDto;
};
