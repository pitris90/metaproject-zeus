import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10004;
const HTTP_MESSAGE = 'Project has invalid status for this action';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class ProjectInvalidStatusApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
