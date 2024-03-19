import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10002;
const HTTP_MESSAGE = 'Project not found';
const HTTP_STATUS = HttpStatus.NOT_FOUND;

export class ProjectNotFoundApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
