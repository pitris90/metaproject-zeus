import { Injectable } from '@nestjs/common';
import { UserInfoDto } from '../dto/user-info.dto';
import { OidcService } from './oidc.service';

@Injectable()
export class TokenService {
	constructor(private readonly oidcService: OidcService) {}

	async getUserInfo(token: string): Promise<UserInfoDto> {
		return this.oidcService.getUserInfo(token);
	}
}
