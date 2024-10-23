import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, Observable } from 'rxjs';
import { AxiosResponse } from 'axios';
import { PerunManager } from '../entities/manager.entity';
import { PerunApiException } from '../exceptions/perun-api.exception';

@Injectable()
export class PerunApiService {
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

	async callBasic<T>(manager: PerunManager, method: string, params: Record<string, string>): Promise<T> {
		const response$ = this.httpService.post(`${this.baseUrl}/ba/rpc/json/${manager}/${method}`, params, {
			withCredentials: true,
			auth: {
				username: this.user,
				password: this.password
			}
		});
		return this.handleResponse(response$);
	}

	async callOauth<T>(
		token: string,
		manager: PerunManager,
		method: string,
		params: Record<string, string>
	): Promise<T> {
		const response$ = this.httpService.post(`${this.baseUrl}/oauth/rpc/json/${manager}/${method}`, params, {
			withCredentials: true,
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
		return this.handleResponse(response$);
	}

	private async handleResponse<T>(response$: Observable<AxiosResponse>): Promise<T> {
		const result = await lastValueFrom(response$);

		if (result.status !== 200) {
			throw new PerunApiException(`Perun API call failed: ${result.statusText}`);
		}

		return result.data;
	}
}
