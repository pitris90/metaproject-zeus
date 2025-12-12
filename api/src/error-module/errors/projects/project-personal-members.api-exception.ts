import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10006;
const HTTP_MESSAGE = 'Cannot add members to a personal project';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class ProjectPersonalMembersApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
