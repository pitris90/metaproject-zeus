import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

const KEY_PREFIX = 'token_';
const TOKEN_TTL = 60; // in seconds

@Injectable()
export class TokenCache {
	constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

	async setToken(token: string, externalId: string) {
		await this.cacheManager.set(`${KEY_PREFIX}_${token}`, externalId, TOKEN_TTL * 1000);
	}

	async getToken(token: string): Promise<string | undefined> {
		return this.cacheManager.get(`${KEY_PREFIX}_${token}`);
	}

	async removeToken(token: string) {
		await this.cacheManager.del(`${KEY_PREFIX}_${token}`);
	}
}
