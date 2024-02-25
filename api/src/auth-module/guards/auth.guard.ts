import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();

		// TODO this will be probably some token or something, for now we just send ID directly
		const userId = request.headers['x-user-id'];
		if (!userId) {
			throw new UnauthorizedException();
		}

		return true;
	}
}
