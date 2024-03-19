import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

export class ProjectHasApprovalException extends ApiException {
	constructor() {
		super(10003, 'Project is already approved or denied', HttpStatus.FORBIDDEN);
	}
}
