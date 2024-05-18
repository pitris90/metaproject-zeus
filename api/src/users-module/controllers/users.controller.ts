import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserInfoListDto } from '../dtos/user-info.dto';

// TODO will load users from perun
const USERS = [
	{
		id: 1,
		name: 'John Doe',
		email: 'johndoe@email.com',
		username: 'johndoe'
	},
	{
		id: 2,
		name: 'Jane Doe',
		email: 'janedoe@email.com',
		username: 'janedoe'
	},
	{
		id: 3,
		name: 'Alice',
		email: 'alice@email.com',
		username: 'alice'
	},
	{
		id: 4,
		name: 'Adam',
		username: 'adam',
		email: 'adam@email.com'
	},
	{
		id: 5,
		name: 'Alena',
		username: 'alena',
		email: 'alena@email.com'
	}
];

@ApiTags('User')
@Controller('/users')
export class UsersController {
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

		const users = USERS.filter((user) => user.username.startsWith(query));
		return {
			users
		};
	}
}
