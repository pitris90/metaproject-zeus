import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	Allocation,
	AllocationOpenstackRequest,
	Project,
	ResourceUsageEvent,
	ResourceUsageEventLink,
	User
} from 'resource-manager-database';
import { ResourceUsageController } from './controllers/resource-usage.controller';
import { ResourceUsageSummaryController } from './controllers/resource-usage-summary.controller';
import { ResourceUsageService } from './services/resource-usage.service';
import { ResourceUsageSummaryService } from './services/resource-usage-summary.service';
import { ResourceUsageIdentityMapperService } from './services/resource-usage-identity-mapper.service';
import { CollectorApiKeyGuard } from './guards/collector-api-key.guard';
import { ResourceUsageMappingService } from './services/resource-usage-mapping.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ResourceUsageEvent,
			ResourceUsageEventLink,
			User,
			Project,
			Allocation,
			AllocationOpenstackRequest
		])
	],
	controllers: [ResourceUsageController, ResourceUsageSummaryController],
	providers: [
		ResourceUsageService,
		ResourceUsageSummaryService,
		ResourceUsageIdentityMapperService,
		ResourceUsageMappingService,
		CollectorApiKeyGuard
	],
	exports: [ResourceUsageService]
})
export class ResourceUsageModule {}
