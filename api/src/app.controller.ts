import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth-module/decorators/public.decorator';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	@Public()
	getHello(): { text: string } {
		return {
			text: this.appService.getHello()
		};
	}
}
