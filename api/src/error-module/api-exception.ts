import { HttpException } from '@nestjs/common';

export class ApiException extends HttpException {
	constructor(code: number, message: string, status: number) {
		super(
			{
				message: message,
				statusCode: status,
				code: code
			},
			status
		);
	}
}
