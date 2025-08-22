import { Injectable, Logger, Scope } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, Observable } from 'rxjs';
import { AxiosError } from 'axios';
import { PerunManager } from '../entities/manager.entity';
import { PerunApiException } from '../exceptions/perun-api.exception';
import { Group } from '../entities/group.entity';
import { PerunAttribute } from '../entities/perun-attribute.entity';

@Injectable({ scope: Scope.REQUEST })
export class PerunApiService {
	private cookie: string;
	private readonly logger = new Logger(PerunApiService.name);

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

	private get isBypass(): boolean {
		return !!this.configService.get<boolean>('AUTH_BYPASS');
	}
	/**
	 * Calls PERUN API method via service account.
	 *
	 * @param manager PERUN manager
	 * @param method PERUN method name
	 * @param params PERUN params
	 */
	callBasic<T>(manager: PerunManager, method: string, params: Record<string, any>): Promise<T> {
		// Local dev bypass: return safe stubbed responses
		if (this.isBypass) {
			return Promise.resolve(this.mockBasicResponse(manager, method, params) as T);
		}
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
		if (this.isBypass) {
			return Promise.resolve(this.mockBasicResponse(manager, method, params) as T);
		}
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

	private mockBasicResponse(manager: PerunManager, method: string, params: Record<string, any>): unknown {
		this.logger.warn(`AUTH_BYPASS=true: Mocking Perun call ${manager}.${method}`);
		switch (manager) {
			case PerunManager.GROUPS:
				if (method === 'createGroup') {
					return this.fakeGroup(params?.['name'] ?? 'dev-group', params?.['description'] ?? 'Dev Group');
				}
				if (method === 'getGroupById') {
					return this.fakeGroup(`group-${params?.['id'] ?? 1}`, 'Dev Group', params?.['id'] ?? 1);
				}
				if (method === 'isGroupMember') {
					return true;
				}
				break;
			case PerunManager.ATTRIBUTES:
				if (method === 'getAttribute') {
					return this.fakeAttribute(params?.['attributeName'] ?? 'attr', null);
				}
				if (method === 'getAttributes') {
					return [this.fakeAttribute('attr1', null), this.fakeAttribute('attr2', null)];
				}
				if (method === 'setAttribute') {
					return true;
				}
				break;
			case PerunManager.AUTHZ:
				if (method === 'setRole') {
					return true;
				}
				break;
			case PerunManager.REGISTRAR:
				if (method === 'copyForm' || method === 'copyMails') {
					return true;
				}
				break;
			case PerunManager.INVITATIONS:
				if (method === 'inviteToGroup') {
					return true;
				}
				break;
			case PerunManager.MEMBERS:
				// Return minimal successful responses for any member-related lookup
				return { id: 1 };
		}
		return {};
	}

	private fakeGroup(name: string, description: string, id?: number): Group {
		return {
			id: id ?? Math.floor(Math.random() * 100000) + 1,
			createdAt: new Date().toISOString(),
			createdBy: 'bypass',
			modifiedAt: new Date().toISOString(),
			modifiedBy: 'bypass',
			createdByUid: 0,
			modifiedByUid: 0,
			voId: null,
			parentGroupId: null,
			name,
			description,
			uuid: '00000000-0000-0000-0000-000000000000',
			shortName: name,
			beanName: 'Group'
		};
	}

	private fakeAttribute(name: string, value: any): PerunAttribute {
		return {
			id: 1,
			createdAt: new Date().toISOString(),
			createdBy: 'bypass',
			modifiedAt: new Date().toISOString(),
			createdByUid: 0,
			modifiedByUid: 0,
			friendlyName: name,
			namespace: 'urn:perun:group:attribute-def:def',
			description: 'Bypass attribute',
			displayName: name,
			type: 'java.lang.String',
			value: value,
			writable: true,
			unique: false,
			valueCreatedAt: null,
			valueModifiedAt: null,
			valueCreatedBy: null,
			valueModifiedBy: null,
			baseFriendlyName: name,
			friendlyNameParameter: '',
			entity: 'group',
			beanName: 'Attribute'
		};
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
