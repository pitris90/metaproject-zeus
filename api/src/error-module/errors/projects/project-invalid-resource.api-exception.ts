import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10005;
const HTTP_MESSAGE = 'Invalid resource requested.';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class ProjectInvalidResourceApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
