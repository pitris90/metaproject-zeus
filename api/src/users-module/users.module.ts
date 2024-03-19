import { Module } from '@nestjs/common';
import { UsersModel } from './models/users.model';
import { UserMapper } from './services/user.mapper';

@Module({
	providers: [UsersModel, UserMapper],
	exports: [UsersModel, UserMapper]
})
export class UsersModule {}
