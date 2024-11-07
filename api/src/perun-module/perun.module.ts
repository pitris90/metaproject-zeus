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
import { FailedStageModel } from './models/failed-stage.model';
import { PerunRegistrarService } from './services/managers/perun-registrar.service';

@Module({
	imports: [
		HttpModule,
		BullModule.registerQueue({
			name: 'perun'
		})
	],
	exports: [PerunFacade],
	providers: [
		FailedStageModel,
		PerunApiService,
		PerunGroupService,
		PerunFacade,
		PerunGroupConsumer,
		PerunMembersService,
		PerunAttributesService,
		PerunAuthzService,
		PerunRegistrarService
	]
})
export class PerunModule {}
