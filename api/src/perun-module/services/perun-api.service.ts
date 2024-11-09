import { Injectable, Scope } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, Observable } from 'rxjs';
import { AxiosError } from 'axios';
import { PerunManager } from '../entities/manager.entity';
import { PerunApiException } from '../exceptions/perun-api.exception';

@Injectable({ scope: Scope.REQUEST })
export class PerunApiService {
	private cookie: string;

	private readonly baseUrl: string;
	private readonly user: string;
	private readonly password: string;

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService
	) {
		this.baseUrl = this.configService.getOrThrow('PERUN_URL');
		this.user = this.configService.getOrThrow('PERUN_USER');
		this.password = this.configService.getOrThrow('PERUN_PASSWORD');
	}

	/**
	 * Calls PERUN API method via service account.
	 *
	 * @param manager PERUN manager
	 * @param method PERUN method name
	 * @param params PERUN params
	 */
	callBasic<T>(manager: PerunManager, method: string, params: Record<string, any>): Promise<T> {
		const response$ = this.httpService.post(`${this.baseUrl}/ba/rpc/json/${manager}/${method}`, params, {
			withCredentials: true,
			withXSRFToken: true,
			auth: {
				username: this.user,
				password: this.password
			},
			headers: {
				'X-XSRF-TOKEN': this.cookie,
				Cookie: `XSRF-TOKEN=${this.cookie}`
			}
		});
		return this.handleResponse(response$);
	}

	/**
	 * Calls PERUN API method via OAuth token (this method joins concrete action in PERUN to user).
	 *
	 * @param token of user which is doing the action
	 * @param manager PERUN manager
	 * @param method PERUN method name
	 * @param params PERUN params
	 */
	async callOauth<T>(token: string, manager: PerunManager, method: string, params: Record<string, any>): Promise<T> {
		const response$ = this.httpService.post(`${this.baseUrl}/oauth/rpc/json/${manager}/${method}`, params, {
			withCredentials: true,
			withXSRFToken: true,
			headers: {
				Authorization: `Bearer ${token}`,
				'X-XSRF-TOKEN': this.cookie,
				Cookie: `XSRF-TOKEN=${this.cookie}`
			}
		});
		return this.handleResponse(response$);
	}

	private async handleResponse<T>(response$: Observable<any>): Promise<T> {
		try {
			const result = await lastValueFrom(response$);

			// if response has correct cookies, set session
			if (result.headers['set-cookie']) {
				const perunSession = result.headers['set-cookie']?.find((cookie) => cookie.startsWith('PERUNSESSION'));
				if (perunSession) {
					this.cookie = perunSession.split(';')[0].split('=')[1];
				}
			}

			return result.data;
		} catch (error) {
			if (error instanceof AxiosError) {
				const data = error.response?.data as Record<string, string>;
				throw new PerunApiException(data['name'], data['message']);
			}

			throw error;
		}
	}
}
