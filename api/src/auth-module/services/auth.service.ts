import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from 'resource-manager-database';
import { InvalidUserApiException } from '../../error-module/errors/users/invalid-user.api-exception';
import { UserInfoDto } from '../dto/user-info.dto';
import { UsersModel } from '../../users-module/models/users.model';

@Injectable()
export class AuthService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly usersModel: UsersModel
	) {}

	async signIn(profile: UserInfoDto): Promise<User | null> {
		const email = profile.email;

		if (!email) {
			throw new InvalidUserApiException();
		}

		const insertResult = await this.dataSource.getRepository(User).upsert(
			{
				source: 'perun',
				externalId: profile.sub,
				email: profile.email,
				emailVerified: profile.email_verified,
				username: profile.preferred_username,
				name: profile.name,
				// TODO 1 for now, will be provided from OAuth later
				roleId: 1
			},
			['source', 'externalId']
		);

		return this.usersModel.findUserById(insertResult.identifiers[0]['id']);
	}
}
