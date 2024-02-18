import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsCheck } from '../decorators/permissions.decorator';
import { Permission } from '../models/permission.enum';

@Injectable()
export class CheckPermissionGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const permissions = this.reflector.get(PermissionsCheck, context.getHandler());
		// endpoint has no specific permissions defined, so it's available for all
		if (!permissions) {
			return true;
		}

		// TODO get permissions of logged user, available only after authentication
		const userPermissions: Permission[] = [];
		return permissions.every((p) => userPermissions.includes(p));
	}
}
