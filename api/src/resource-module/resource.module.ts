import { Module } from '@nestjs/common';
import { ResourceTypeController } from './controllers/resource-type.controller';
import { ResourceTypeService } from './services/resource-type.service';
import { ResourceMapper } from './mappers/resource.mapper';
import { ResourceAdminController } from './controllers/resource-admin.controller';
import { ResourceService } from './services/resource.service';
import { ResourceController } from './controllers/resource.controller';

@Module({
	controllers: [ResourceTypeController, ResourceAdminController, ResourceController],
	providers: [ResourceTypeService, ResourceMapper, ResourceService]
})
export class ResourceModule {}
