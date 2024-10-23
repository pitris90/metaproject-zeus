import { Module } from '@nestjs/common';
import { PerunUserService } from './services/perun-user.service';
import { PerunApiService } from './services/perun-api.service';

@Module({
	exports: [PerunUserService],
	providers: [PerunUserService, PerunApiService]
})
export class PerunModule {}
