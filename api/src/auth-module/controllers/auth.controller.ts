import { Controller, Post, UnauthorizedException, Headers, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { SignInDto } from '../dto/sign-in.dto';
import { UsersModel } from '../../users-module/models/users.model';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
	constructor(
		private readonly tokenService: TokenService,
		private readonly authService: AuthService,
		private readonly usersModel: UsersModel
	) {}

	@Post('sign-in')
	@Public()
	async signIn(@Headers('Authorization') authorizationHeader: string, @Body() signIn: SignInDto): Promise<void> {
		const accessToken = authorizationHeader.split(' ')[1]?.trim();

		if (!accessToken) {
			throw new UnauthorizedException();
		}

		// only optimization - if user exists, we don't want to change anything
		const user = await this.usersModel.findUserByExternalId(signIn.externalId);
		if (user) {
			return;
		}

		// otherwise get data from endpoint
		const userInfo = await this.tokenService.getUserInfo(accessToken);
		await this.authService.signIn(userInfo);
	}
}
