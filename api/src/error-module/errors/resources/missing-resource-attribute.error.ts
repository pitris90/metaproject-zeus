import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 13001;
const HTTP_MESSAGE = 'Missing resource attribute.';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class MissingResourceAttributeError extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
