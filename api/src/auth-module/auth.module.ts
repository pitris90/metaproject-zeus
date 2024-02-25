import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users-module/users.module';
import { AuthGuard } from './guards/auth.guard';

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: AuthGuard
		}
	],
	imports: [UsersModule]
})
export class AuthModule {}
