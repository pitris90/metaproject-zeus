import { Module } from '@nestjs/common';
import { ResourceTypeController } from './controllers/resource-type.controller';
import { ResourceTypeService } from './services/resource-type.service';
import { ResourceMapper } from './mappers/resource.mapper';
import { ResourceAdminController } from './controllers/resource-admin.controller';
import { ResourceService } from './services/resource.service';
import { ResourceController } from './controllers/resource.controller';
import { AttributeTypeController } from './controllers/attribute-type.controller';
import { AttributeTypeService } from './services/attribute-type.service';
import { AttributeMapper } from './mappers/attribute.mapper';

@Module({
	controllers: [ResourceTypeController, ResourceAdminController, ResourceController, AttributeTypeController],
	providers: [ResourceTypeService, ResourceMapper, ResourceService, AttributeTypeService, AttributeMapper]
})
export class ResourceModule {}
