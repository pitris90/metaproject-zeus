import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MinRoleCheck } from '../decorators/min-role.decorator';
import { UsersModel } from '../../users-module/models/users.model';
import { RoleEnum } from '../models/role.enum';
import { IS_PUBLIC_KEY } from '../../auth-module/decorators/public.decorator';

@Injectable()
export class CheckPermissionGuard implements CanActivate {
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

		const minRole = this.reflector.getAllAndOverride(MinRoleCheck, [context.getHandler(), context.getClass()]);
		// endpoint has no specific permissions defined, so it's available for all
		if (!minRole) {
			throw new Error('Please define minimum allowed role for endpoint.');
		}

		const user = context.switchToHttp().getRequest().user;
		const userRole = await this.usersModel.getUserRole(user.id);

		if (!userRole) {
			return false;
		}

		if (minRole === RoleEnum.ADMIN) {
			return userRole.codeName === RoleEnum.ADMIN;
		}

		if (minRole === RoleEnum.DIRECTOR) {
			return userRole.codeName === RoleEnum.DIRECTOR || userRole.codeName === RoleEnum.ADMIN;
		}

		return true;
	}
}
