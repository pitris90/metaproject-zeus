import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MinRoleCheck } from '../decorators/min-role.decorator';
import { UsersModel } from '../../users-module/models/users.model';
import { RoleEnum } from '../models/role.enum';

@Injectable()
export class CheckPermissionGuard implements CanActivate {
	constructor(
		private readonly usersModel: UsersModel,
		private readonly reflector: Reflector
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const role = this.reflector.getAllAndOverride(MinRoleCheck, [context.getHandler(), context.getClass()]);
		// endpoint has no specific permissions defined, so it's available for all
		if (!role) {
			throw new Error('Please define minimum allowed role for endpoint.');
		}

		const user = context.switchToHttp().getRequest().user;
		const userRole = await this.usersModel.getUserRole(user.id);
		if (!userRole) {
			return false;
		}

		if (userRole.codeName === RoleEnum.ADMIN) {
			return true;
		}

		if (userRole.codeName === RoleEnum.DIRECTOR) {
			return role !== RoleEnum.ADMIN;
		}

		return role === RoleEnum.USER;
	}
}
