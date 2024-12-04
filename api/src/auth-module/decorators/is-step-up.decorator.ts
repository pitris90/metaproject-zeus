import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IsStepUp = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
	const request = ctx.switchToHttp().getRequest();
	return request.isStepUp;
});
