import { Injectable } from '@nestjs/common';
import { UserInfoDto } from '../dto/user-info.dto';
import { TokenCache } from '../cache/token.cache';
import { UsersModel } from '../../users-module/models/users.model';
import { AuthMapper } from '../mapper/auth.mapper';
import { OidcService } from './oidc.service';

@Injectable()
export class TokenService {
	constructor(
		private readonly oidcService: OidcService,
		private readonly tokenCache: TokenCache,
		private readonly usersModel: UsersModel,
		private readonly authMapper: AuthMapper
	) {}

	async getUserInfo(token: string): Promise<UserInfoDto> {
		const cacheHit = await this.tokenCache.getToken(token);

		// try from cache
		if (cacheHit) {
			const user = await this.usersModel.findUserByExternalId(cacheHit);
			// user exists we can use these data for now
			if (user) {
				return this.authMapper.toUserInfoDto(user);
			}
		}

		return this.oidcService.getUserInfo(token);
	}

	async getUserExternalId(token: string): Promise<string | undefined> {
		if (!token) {
			return;
		}

		// try from cache
		const cacheHit = await this.tokenCache.getToken(token);

		if (cacheHit) {
			return cacheHit;
		}

		// call introspection endpoint
		const introspectionDto = await this.oidcService.getIntrospection(token);
		if (!introspectionDto || !introspectionDto.active) {
			await this.tokenCache.removeToken(token);
			return;
		}

		// token is active
		await this.tokenCache.setToken(token, introspectionDto.sub);
		return introspectionDto.sub;
	}
}
