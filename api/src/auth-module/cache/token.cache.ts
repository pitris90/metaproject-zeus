import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

const KEY_PREFIX = 'token_';

@Injectable()
export class TokenCache {
	constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

	async setToken(token: string, externalId: string, expiration: number) {
		await this.cacheManager.set(`${KEY_PREFIX}_${token}`, externalId, expiration * 1000);
	}

	async getToken(token: string): Promise<string | undefined> {
		return this.cacheManager.get(`${KEY_PREFIX}_${token}`);
	}

	async removeToken(token: string) {
		await this.cacheManager.del(`${KEY_PREFIX}_${token}`);
	}
}
