import { Module } from '@nestjs/common';
import { ResourceTypeController } from './controllers/resource-type.controller';
import { ResourceTypeService } from './services/resource-type.service';
import { ResourceMapper } from './mappers/resource.mapper';

@Module({
	controllers: [ResourceTypeController],
	providers: [ResourceTypeService, ResourceMapper]
})
export class ResourceModule {}
