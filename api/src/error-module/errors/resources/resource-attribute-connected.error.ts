import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 13002;
const HTTP_MESSAGE = 'Resource attribute already belongs to resource.';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class ResourceAttributeConnectedError extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
