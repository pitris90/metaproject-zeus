import { Module } from '@nestjs/common';
import { UsersModel } from './models/users.model';

@Module({
	providers: [UsersModel],
	exports: [UsersModel]
})
export class UsersModule {}
