import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenstackAllocationService } from './services/openstack-allocation.service';
import { OpenstackYamlBuilderService } from './services/openstack-yaml-builder.service';
import { OpenstackTagsCatalogService } from './services/openstack-tags.service';
import { OpenstackGitService } from './services/openstack-git.service';

@Module({
	imports: [ConfigModule],
	providers: [
		OpenstackAllocationService,
		OpenstackYamlBuilderService,
		OpenstackTagsCatalogService,
		OpenstackGitService
	],
	exports: [OpenstackAllocationService]
})
export class OpenstackModule {}
