import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class Pagination {
	@ApiProperty()
	page: number;
	@ApiProperty()
	limit: number;
	// is calculated internally
	offset: number;
}

export const GetPagination = createParamDecorator((_data: unknown, ctx: ExecutionContext): Pagination => {
	const req = ctx.switchToHttp().getRequest();

	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;

	const offset = (page - 1) * limit;

	return {
		page,
		offset,
		limit
	};
});
