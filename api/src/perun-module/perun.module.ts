import { Module } from '@nestjs/common';
import { PerunUserService } from './services/perun-user.service';

@Module({
	exports: [PerunUserService],
	providers: [PerunUserService]
})
export class PerunModule {}
