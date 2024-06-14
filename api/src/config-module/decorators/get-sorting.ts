import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export type SortDirection = 'ASC' | 'DESC';

export class Sorting {
	@ApiProperty()
	columnAccessor: string;
	@ApiProperty()
	direction: SortDirection;
}

export const GetSorting = createParamDecorator((_data: unknown, ctx: ExecutionContext): Sorting | null => {
	const req = ctx.switchToHttp().getRequest();

	const sortSelector = req.query.sort as string;

	if (!sortSelector) {
		return null;
	}

	const direction = sortSelector.startsWith('-') ? 'DESC' : 'ASC';
	const accessor = sortSelector.startsWith('-') ? sortSelector.slice(1) : sortSelector;

	return {
		columnAccessor: accessor,
		direction
	};
});
