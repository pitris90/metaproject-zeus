import { Controller, Get, HttpStatus, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { OpenIdConnectGuard } from '../guards/open-id-connect.guard';
import { Public } from '../decorators/public.decorator';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
	@Get('login')
	@Public()
	@UseGuards(OpenIdConnectGuard)
	async logIn() {}

	@Get('callback')
	@UseGuards(OpenIdConnectGuard)
	async logInCallback(@Req() req: Request, @Res() res: Response) {
		console.log(req);

		return res.status(HttpStatus.OK);
	}
}
