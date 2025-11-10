import { Module } from '@nestjs/common';
import { ProjectModule } from '../project-module/project.module';
import { ApiConfigModule } from '../config-module/api-config.module';
import { ResourceTypeController } from './controllers/resource-type.controller';
import { ResourceTypeService } from './services/resource-type.service';
import { ResourceMapper } from './mappers/resource.mapper';
import { ResourceAdminController } from './controllers/resource-admin.controller';
import { ResourceService } from './services/resource.service';
import { ResourceController } from './controllers/resource.controller';
import { AttributeTypeController } from './controllers/attribute-type.controller';
import { AttributeTypeService } from './services/attribute-type.service';
import { AttributeMapper } from './mappers/attribute.mapper';
import { AllocationController } from './controllers/allocation.controller';
import { AllocationService } from './services/allocation.service';
import { AllocationMapper } from './mappers/allocation.mapper';
import { OpenstackModule } from '../openstack-module/openstack.module';

@Module({
	imports: [ProjectModule, ApiConfigModule, OpenstackModule],
	controllers: [
		ResourceTypeController,
		ResourceAdminController,
		ResourceController,
		AttributeTypeController,
		AllocationController
	],
	providers: [
		ResourceTypeService,
		ResourceMapper,
		ResourceService,
		AttributeTypeService,
		AttributeMapper,
		AllocationService,
		AllocationMapper
	]
})
export class ResourceModule {}
