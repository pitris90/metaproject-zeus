import { Controller, Get } from '@nestjs/common';
import { Public } from './auth-module/decorators/public.decorator';

@Controller()
export class AppController {
	@Get()
	@Public()
	getHello(): { text: string } {
		return {
			text: 'Hello World!'
		};
	}
}
