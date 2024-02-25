import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users-module/users.module';
import { CheckPermissionGuard } from './guards/check-permission.guard';

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: CheckPermissionGuard
		}
	],
	exports: [],
	imports: [UsersModule]
})
export class PermissionModule {}
