import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsCheck } from '../decorators/permissions.decorator';
import { RolesCheck } from '../decorators/roles.decorator';
import { UsersModel } from '../../users-module/models/users.model';

@Injectable()
export class CheckPermissionGuard implements CanActivate {
	constructor(
		private readonly usersModel: UsersModel,
		private readonly reflector: Reflector
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const permissions = this.reflector.get(PermissionsCheck, context.getHandler());
		const roles = this.reflector.get(RolesCheck, context.getHandler());
		// endpoint has no specific permissions defined, so it's available for all
		if (!permissions && !roles) {
			return true;
		}

		// it shouldn't be allowed to define both roles and permissions auth
		if (permissions && roles) {
			throw new Error('Please define only permissions or roles for endpoint. Both options cannot be defined.');
		}

		const user = context.switchToHttp().getRequest().user;
		const userPermissions = await this.usersModel.getUserRole(user.id);
		if (!userPermissions) {
			return false;
		}

		if (permissions) {
			const userPermissionNames = userPermissions.role.permissionsToRole.map((p) => p.permission.codeName);
			return permissions.every((p) => userPermissionNames.includes(p.toString()));
		}

		return roles.some((role) => role.toString() === userPermissions.role.codeName);
	}
}
