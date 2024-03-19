import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10001;
const HTTP_MESSAGE = 'Project request already exists';
const HTTP_STATUS = HttpStatus.CONFLICT;

export class ProjectRequestExistsApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
