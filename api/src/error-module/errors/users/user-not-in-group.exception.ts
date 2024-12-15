import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 11003;
const HTTP_MESSAGE = 'User not in group.';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class UserNotInGroupException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
