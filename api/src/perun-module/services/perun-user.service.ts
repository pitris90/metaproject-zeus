import { Injectable } from '@nestjs/common';

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
		name: 'Alice In Wonderland',
		email: 'alice@email.com',
		username: 'alice'
	},
	{
		id: 4,
		name: 'Adam Valalsky',
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

@Injectable()
export class PerunUserService {
	public getUsersByCriteria(query: string) {
		return USERS.filter((user) => user.username.startsWith(query));
	}
}
