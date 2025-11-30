import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 15001;
const HTTP_MESSAGE = 'Only one active OpenStack allocation can exist for a project.';
const HTTP_STATUS = HttpStatus.BAD_REQUEST;

export class OpenstackAllocationExistsError extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
