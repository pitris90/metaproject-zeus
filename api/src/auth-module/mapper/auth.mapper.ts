import { Injectable } from '@nestjs/common';
import { User } from 'resource-manager-database';
import { UserInfoDto } from '../dto/user-info.dto';

@Injectable()
export class AuthMapper {
	toUserInfoDto(user: User): UserInfoDto {
		return {
			sub: user.externalId,
			name: user.name,
			email: user.email,
			email_verified: user.emailVerified,
			preferred_username: user.username,
			locale: user.locale
		};
	}
}
