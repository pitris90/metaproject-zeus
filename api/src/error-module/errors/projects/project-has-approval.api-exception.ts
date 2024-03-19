import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../api-exception';

const CODE = 10003;
const HTTP_MESSAGE = 'Project is already approved or denied';
const HTTP_STATUS = HttpStatus.FORBIDDEN;

export class ProjectHasApprovalApiException extends ApiException {
	override code = CODE;
	override httpMessage = HTTP_MESSAGE;
	override httpStatus = HTTP_STATUS;

	constructor() {
		super(CODE, HTTP_MESSAGE, HTTP_STATUS);
	}
}
