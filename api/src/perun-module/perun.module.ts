import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { PerunUserService } from './services/perun-user.service';
import { PerunApiService } from './services/perun-api.service';
import { PerunGroupService } from './services/perun-group.service';
import { PerunFacade } from './perun.facade';
import { PerunGroupConsumer } from './consumers/perun-group.consumer';

@Module({
	imports: [
		HttpModule,
		BullModule.registerQueue({
			name: 'perun'
		})
	],
	exports: [PerunUserService, PerunFacade],
	providers: [PerunUserService, PerunApiService, PerunGroupService, PerunFacade, PerunGroupConsumer]
})
export class PerunModule {}
