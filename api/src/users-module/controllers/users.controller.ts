import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserInfoListDto } from '../dtos/user-info.dto';
import { PerunUserService } from '../../perun-module/services/perun-user.service';

@ApiTags('User')
@Controller('/users')
export class UsersController {
	public constructor(private readonly perunUserService: PerunUserService) {}

	@Get('/')
	@ApiOperation({
		summary: 'Get all users matching query.',
		description: 'Get all users matching query.'
	})
	@ApiQuery({
		name: 'query',
		required: true,
		description: 'Query to search users.'
	})
	@ApiOkResponse({
		description: 'Users matching query.',
		type: [UserInfoListDto]
	})
	getUsersByCriteria(@Query('query') query: string): UserInfoListDto {
		if (!query) {
			return {
				users: []
			};
		}

		return {
			users: this.perunUserService.getUsersByCriteria(query)
		};
	}
}
