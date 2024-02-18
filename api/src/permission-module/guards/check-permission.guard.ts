import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsCheck } from '../decorators/permissions.decorator';
import { PermissionEnum } from '../models/permission.enum';
import { RolesCheck } from '../decorators/roles.decorator';
import { RoleEnum } from '../models/role.enum';

@Injectable()
export class CheckPermissionGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
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

		if (permissions) {
			// TODO get permissions of logged user, available only after authentication
			const userPermissions: PermissionEnum[] = [];
			return permissions.every((p) => userPermissions.includes(p));
		}

		// TODO get role of logged user
		const userRole = RoleEnum.USER;
		return roles.includes(userRole);
	}
}
