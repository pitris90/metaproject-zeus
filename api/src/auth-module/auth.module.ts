import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { UsersModule } from '../users-module/users.module';
import { AuthGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { OidcService } from './services/oidc.service';
import { TokenService } from './services/token.service';
import { TokenCache } from './cache/token.cache';

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: AuthGuard
		},
		AuthService,
		OidcService,
		TokenService,
		TokenCache
	],
	controllers: [AuthController],
	imports: [UsersModule, HttpModule]
})
export class AuthModule {}
