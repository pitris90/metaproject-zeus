import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

export class ProjectRequestExistsException extends ApiException {
	constructor() {
		super(10001, 'Project request already exists', HttpStatus.CONFLICT);
	}
}
