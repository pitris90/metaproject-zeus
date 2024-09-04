import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-openidconnect';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class OpenIdStrategy extends PassportStrategy(Strategy, 'open-id-connect') {
	constructor(
		private readonly authService: AuthService,
		configService: ConfigService
	) {
		super({
			issuer: configService.get<string>('IDENTITY_ISSUER'),
			clientID: configService.get<string>('IDENTITY_CLIENT_ID'),
			clientSecret: configService.get<string>('IDENTITY_CLIENT_SECRET'),
			authorizationURL: configService.get('IDENTITY_AUTHORIZATION_URL'),
			tokenURL: configService.get('IDENTITY_TOKEN_URL'),
			callbackURL: configService.get('IDENTITY_CALLBACK_URL'),
			userInfoURL: configService.get('IDENTITY_USER_INFO_URL'),
			responseType: 'code',
			scope: ['openid', 'profile', 'email']
		});
	}

	async validate(_authority: string, profile: Profile, done: VerifyCallback): Promise<void> {
		const user = await this.authService.signIn(profile);
		done(null, user);
	}
}
