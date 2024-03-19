import { HttpException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class ApiException extends HttpException {
	code: number;

	@ApiProperty({ name: 'message' })
	httpMessage: string;

	@ApiProperty({ name: 'status' })
	httpStatus: number;

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
