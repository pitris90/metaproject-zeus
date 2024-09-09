import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
	@Get('login')
	@Public()
	async logIn() {}

	@Get('callback')
	@Public()
	async logInCallback(@Req() req: Request, @Res() res: Response) {
		return res.redirect(`http://localhost:5137/auth/login?token=my_token}`);
	}
}
