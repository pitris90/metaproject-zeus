import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users-module/users.module';
import { AuthGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: AuthGuard
		},
		AuthService
	],
	controllers: [AuthController],
	imports: [UsersModule]
})
export class AuthModule {}
