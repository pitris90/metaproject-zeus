import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsersModel } from '../../users-module/models/users.model';
import { UserMapper } from '../../users-module/services/user.mapper';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly usersModel: UsersModel,
		private readonly reflector: Reflector,
		private readonly userMapper: UserMapper
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
		const authorizationHeader = request.headers['Authorization'];

		// authorization header not present
		if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
			throw new UnauthorizedException();
		}

		// const accessToken = authorizationHeader.split('Bearer ')[1].trim();

		// TODO this will be probably some token or something, for now we just send ID directly
		const userId = request.headers['x-user-id'];
		if (!userId) {
			throw new UnauthorizedException();
		}

		const user = await this.usersModel.findUserById(userId);
		if (!user) {
			throw new UnauthorizedException();
		}

		request.user = this.userMapper.toUserDto(user);
		return true;
	}
}
