import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role, User } from 'resource-manager-database';
import { InvalidUserApiException } from '../../error-module/errors/users/invalid-user.api-exception';
import { UserInfoDto } from '../dto/user-info.dto';
import { UsersModel } from '../../users-module/models/users.model';

const PERUN_PREFIX = 'urn:geant:cesnet.cz:res:';
const PERUN_SUFFIX = '#perun.cesnet.cz';

const ADMIN_ROLE_NAME = 'role:admin';
const DIRECTOR_ROLE_NAME = 'role:director';

@Injectable()
export class AuthService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly usersModel: UsersModel
	) {}

	async signIn(profile: UserInfoDto): Promise<User | null> {
		const email = profile.email;

		if (!email || !profile.sub) {
			throw new InvalidUserApiException();
		}

		const role = await this.dataSource.getRepository(Role).findOneBy({
			codeName: this.getRole(profile.eduperson_entitlement)
		});

		if (!role) {
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
				roleId: role.id
			},
			['source', 'email']
		);

		return this.usersModel.findUserById(insertResult.identifiers[0]['id']);
	}

	private getRole(entitlements?: string[]): 'admin' | 'director' | 'user' {
		if (!entitlements) {
			return 'user';
		}

		const perunRoles = entitlements
			.filter((entitlement) => entitlement.endsWith(PERUN_SUFFIX) && entitlement.startsWith(PERUN_PREFIX))
			.map((entitlement) => entitlement.replace(PERUN_PREFIX, '').replace(PERUN_SUFFIX, ''));

		if (perunRoles.includes(ADMIN_ROLE_NAME)) {
			return 'admin';
		}

		if (perunRoles.includes(DIRECTOR_ROLE_NAME)) {
			return 'director';
		}

		return 'user';
	}
}
