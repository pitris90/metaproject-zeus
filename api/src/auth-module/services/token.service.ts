import { Injectable } from '@nestjs/common';
import { UserInfoDto } from '../dto/user-info.dto';
import { TokenCache } from '../cache/token.cache';
import { OidcService } from './oidc.service';

@Injectable()
export class TokenService {
	constructor(
		private readonly oidcService: OidcService,
		private readonly tokenCache: TokenCache
	) {}

	async getUserInfo(token: string): Promise<UserInfoDto> {
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
			// TODO check if we should save to cache if token does not exist
			await this.tokenCache.removeToken(token);
			return;
		}

		// token is active
		await this.tokenCache.setToken(token, introspectionDto.sub, introspectionDto.exp - introspectionDto.iat);
		return introspectionDto.sub;
	}
}
