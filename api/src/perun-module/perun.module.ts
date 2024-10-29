import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { PerunApiService } from './services/perun-api.service';
import { PerunGroupService } from './services/managers/perun-group.service';
import { PerunFacade } from './perun.facade';
import { PerunGroupConsumer } from './consumers/perun-group.consumer';
import { PerunMembersService } from './services/managers/perun-members.service';
import { PerunAttributesService } from './services/managers/perun-attributes.service';
import { PerunAuthzService } from './services/managers/perun-authz.service';

@Module({
	imports: [
		HttpModule,
		BullModule.registerQueue({
			name: 'perun'
		})
	],
	exports: [PerunFacade],
	providers: [
		PerunApiService,
		PerunGroupService,
		PerunFacade,
		PerunGroupConsumer,
		PerunMembersService,
		PerunAttributesService,
		PerunAuthzService
	]
})
export class PerunModule {}
