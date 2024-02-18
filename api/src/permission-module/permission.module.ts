import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CheckPermissionGuard } from './guards/check-permission.guard';

@Module({
	providers: [
		{
			provide: APP_GUARD,
			useClass: CheckPermissionGuard
		}
	],
	exports: []
})
export class PermissionModule {}
