import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsersModel } from '../../users-module/models/users.model';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly usersModel: UsersModel,
		private readonly reflector: Reflector
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

		// TODO this will be probably some token or something, for now we just send ID directly
		const userId = request.headers['x-user-id'];
		if (!userId) {
			throw new UnauthorizedException();
		}

		const user = await this.usersModel.findUserById(userId);
		if (!user) {
			throw new UnauthorizedException();
		}

		request.user = user;
		return true;
	}
}
