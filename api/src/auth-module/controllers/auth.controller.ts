import { Controller, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
	constructor(
		private readonly tokenService: TokenService,
		private readonly authService: AuthService
	) {}

	@Post('sign-in')
	@Public()
	async signIn(@Headers('Authorization') authorizationHeader: string): Promise<void> {
		const accessToken = authorizationHeader.split(' ')[1]?.trim();

		if (!accessToken) {
			throw new UnauthorizedException();
		}

		const userInfo = await this.tokenService.getUserInfo(accessToken);
		await this.authService.signIn(userInfo);
	}
}
