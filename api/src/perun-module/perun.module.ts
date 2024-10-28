import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PerunUserService } from './services/perun-user.service';
import { PerunApiService } from './services/perun-api.service';
import { PerunGroupService } from './services/perun-group.service';
import { PerunFacade } from './perun.facade';

@Module({
	imports: [HttpModule],
	exports: [PerunUserService, PerunFacade],
	providers: [PerunUserService, PerunApiService, PerunGroupService, PerunFacade]
})
export class PerunModule {}
