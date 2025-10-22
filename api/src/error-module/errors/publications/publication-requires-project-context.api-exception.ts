import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 12001;
const HTTP_MESSAGE = 'Publication is linked to multiple projects. Specify projectId to unassign.';
const HTTP_STATUS = HttpStatus.BAD_REQUEST;

export class PublicationRequiresProjectContextApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
