import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10005;
const HTTP_MESSAGE = 'Default project cannot be modified';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class ProjectDefaultImmutableApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
