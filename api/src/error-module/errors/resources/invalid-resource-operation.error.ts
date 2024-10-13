import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 13003;
const HTTP_MESSAGE = 'Invalid resource operation.';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class InvalidResourceOperationError extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
