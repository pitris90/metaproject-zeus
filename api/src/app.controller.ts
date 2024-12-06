import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth-module/decorators/public.decorator';
import { MinRoleCheck } from './permission-module/decorators/min-role.decorator';
import { RoleEnum } from './permission-module/models/role.enum';

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

	@Get('auth')
	@ApiOperation({
		summary: 'Auth check',
		description: 'Returns OK if user is authorized.'
	})
	@MinRoleCheck(RoleEnum.USER)
	getAuth(): { text: string } {
		return {
			text: 'OK'
		};
	}
}
