import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserMapper } from '../../users-module/services/user.mapper';
import { UsersModel } from '../../users-module/models/users.model';
import { TokenService } from '../services/token.service';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly usersModel: UsersModel,
		private readonly tokenService: TokenService,
		private readonly reflector: Reflector,
		private readonly userMapper: UserMapper,
		private readonly configService: ConfigService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass()
		]);

		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest();

		// BYPASS mode: inject mock user for local development / debugging
		if (this.configService.get<boolean>('AUTH_BYPASS')) {
			// Allow opting into step-up header simulation
			const stepUpHeader = request.headers['x-step-up'];
			const forceUserRole = !stepUpHeader || stepUpHeader !== 'true';
			request.isStepUp = !forceUserRole;
			// Try to find first user in DB (deterministic) to keep relations functioning
			let user = await this.usersModel.findUserByExternalId('bypass-external-id');
			if (!user) {
				// Fallback: attempt to load user ID 1 (common seed) or create an inline mock shape
				user = (await this.usersModel.findUserById?.(1)) as any;
			}
			if (!user) {
				// minimal mock object fulfilling mapper expectations
				user = {
					id: 0,
					locale: 'en',
					email: 'mock.user@example.com',
					source: 'bypass',
					externalId: 'bypass-external-id',
					username: 'mockuser',
					name: 'Mock User',
					role: { id: 0, codeName: 'admin', name: 'Admin', users: [], time: new Date() } as any
				} as any;
			}
			request.user = this.userMapper.toUserDto(user as any, forceUserRole);
			return true;
		}

		const authorizationHeader = request.headers['authorization'];

		// authorization header not present
		if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
			throw new UnauthorizedException();
		}

		const stepUpHeader = request.headers['x-step-up'];
		const forceUserRole = !stepUpHeader || stepUpHeader !== 'true';
		request.isStepUp = !forceUserRole;

		const accessToken = authorizationHeader.split('Bearer ')[1].trim();
		const externalId = await this.tokenService.getUserExternalId(accessToken);

		if (!externalId) {
			throw new UnauthorizedException();
		}

		const user = await this.usersModel.findUserByExternalId(externalId);
		if (!user) {
			throw new UnauthorizedException();
		}

		request.user = this.userMapper.toUserDto(user, forceUserRole);
		return true;
	}
}
