import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 15002;
const HTTP_MESSAGE = 'OpenStack allocations are not allowed for personal projects.';
const HTTP_STATUS = HttpStatus.BAD_REQUEST;

export class OpenstackPersonalProjectError extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
