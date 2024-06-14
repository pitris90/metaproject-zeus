import { UserDto } from '../../users-module/dtos/user.dto';

export class MemberDto {
	id: number;
	userInfo: UserDto;
	role: string;
	status: string;
}
