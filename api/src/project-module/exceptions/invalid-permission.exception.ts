import { ProjectPermissionEnum } from '../enums/project-permission.enum';

export class InvalidPermissionException extends Error {
	constructor(permission: ProjectPermissionEnum) {
		super(`Invalid permission: ${permission}`);
	}
}
