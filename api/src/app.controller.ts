import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth-module/decorators/public.decorator';

@Controller()
@ApiTags('Health')
export class AppController {
	@Get()
	@Public()
	@ApiOperation({
		summary: 'Health check',
		description: 'Returns OK if the service is running.'
	})
	getHealth(): { text: string } {
		return {
			text: 'OK'
		};
	}
}
