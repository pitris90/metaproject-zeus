import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

export class ProjectNotFoundException extends ApiException {
	constructor() {
		super(10002, 'Project not found', HttpStatus.NOT_FOUND);
	}
}
