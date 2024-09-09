import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from 'resource-manager-database';
import { InvalidUserApiException } from '../../error-module/errors/users/invalid-user.api-exception';
import { UserInfoDto } from '../dto/user-info.dto';

@Injectable()
export class AuthService {
	constructor(private readonly dataSource: DataSource) {}

	async signIn(profile: UserInfoDto): Promise<void> {
		const email = profile.email;

		if (!email) {
			throw new InvalidUserApiException();
		}

		await this.dataSource.getRepository(User).upsert(
			{
				source: 'perun',
				externalId: profile.sub,
				username: email,
				name: profile.name,
				// TODO 1 for now, will be provided from OAuth later
				roleId: 1
			},
			['source', 'externalId']
		);
	}
}
