import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenstackAllocationService } from './services/openstack-allocation.service';
import { OpenstackYamlBuilderService } from './services/openstack-yaml-builder.service';
import { OpenstackTagsCatalogService } from './services/openstack-tags.service';
import { OpenstackGitService } from './services/openstack-git.service';
import { OpenstackTagsController } from './controllers/openstack-tags.controller';
import { OpenstackConstraintsService } from './services/openstack-constraints.service';
import { OpenstackTerraformParserService } from './services/openstack-terraform-parser.service';

@Module({
	imports: [ConfigModule],
	controllers: [OpenstackTagsController],
	providers: [
		OpenstackAllocationService,
		OpenstackYamlBuilderService,
		OpenstackTagsCatalogService,
		OpenstackGitService,
		OpenstackConstraintsService,
		OpenstackTerraformParserService
	],
	exports: [OpenstackAllocationService, OpenstackTagsCatalogService]
})
export class OpenstackModule {}
