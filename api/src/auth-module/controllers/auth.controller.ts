import {
	Body,
	Controller,
	ForbiddenException,
	Headers,
	Post,
	UnauthorizedException
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { InvalidUserApiException } from '../../error-module/errors/users/invalid-user.api-exception';
import { UserMapper } from '../../users-module/services/user.mapper';
import { UserDto } from '../../users-module/dtos/user.dto';
import { CreateMockUserDto } from '../dto/create-mock-user.dto';
import { UsersModel } from '../../users-module/models/users.model';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
	constructor(
		private readonly tokenService: TokenService,
		private readonly authService: AuthService,
		private readonly userMapper: UserMapper,
		private readonly usersModel: UsersModel,
		private readonly configService: ConfigService
	) {}

	@Post('sign-in')
	@Public()
	@ApiOperation({
		summary: 'Signs in user',
		description: 'Creates user in internal system from access token.'
	})
	async signIn(@Headers('Authorization') authorizationHeader: string): Promise<UserDto> {
		const accessToken = authorizationHeader.split(' ')[1]?.trim();

		if (!accessToken) {
			throw new UnauthorizedException();
		}

		// otherwise get data from endpoint
		const userInfo = await this.tokenService.getUserInfo(accessToken);
		const user = await this.authService.signIn(userInfo);

		if (!user) {
			throw new InvalidUserApiException();
		}

		return this.userMapper.toUserDto(user);
	}

	@Post('mock-user')
	@Public()
	@ApiOperation({
		summary: 'Ensures a mock user exists (AUTH_BYPASS only)',
		description:
			'Create or update a mock user record to support local testing. Available only when AUTH_BYPASS=true.'
	})
	async ensureMockUser(@Body() payload: CreateMockUserDto): Promise<UserDto> {
		if (!this.configService.get<boolean>('AUTH_BYPASS')) {
			throw new ForbiddenException();
		}

		const user = await this.usersModel.ensureMockUser({
			id: payload.id,
			externalId: payload.externalId,
			email: payload.email,
			roleCode: payload.role,
			name: payload.name,
			username: payload.username,
			locale: payload.locale
		});

		return this.userMapper.toUserDto(user);
	}
}
