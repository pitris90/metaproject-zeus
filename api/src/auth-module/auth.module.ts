import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users-module/users.module';
import { AuthGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { OpenIdStrategy } from './strategies/open-id.strategy';
import { AuthController } from './controllers/auth.controller';

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: AuthGuard
		},
		AuthService,
		OpenIdStrategy
	],
	controllers: [AuthController],
	imports: [UsersModule, PassportModule]
})
export class AuthModule {}
