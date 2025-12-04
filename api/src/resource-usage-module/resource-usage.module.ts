import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	Allocation,
	AllocationOpenstackRequest,
	Project,
	ResourceUsageEvent,
	ResourceUsageDailySummary,
	User
} from 'resource-manager-database';
import { OpenstackModule } from '../openstack-module/openstack.module';
import { ResourceUsageController } from './controllers/resource-usage.controller';
import { ResourceUsageSummaryController } from './controllers/resource-usage-summary.controller';
import { ResourceUsageAggregationController } from './controllers/resource-usage-aggregation.controller';
import { ResourceUsageService } from './services/resource-usage.service';
import { ResourceUsageSummaryService } from './services/resource-usage-summary.service';
import { CollectorApiKeyGuard } from './guards/collector-api-key.guard';
import { ResourceUsageAggregationService } from './services/resource-usage-aggregation.service';
import { ResourceUsageProjectMapperService } from './services/resource-usage-project-mapper.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ResourceUsageEvent,
			ResourceUsageDailySummary,
			User,
			Project,
			Allocation,
			AllocationOpenstackRequest
		]),
		OpenstackModule
	],
	controllers: [ResourceUsageController, ResourceUsageSummaryController, ResourceUsageAggregationController],
	providers: [
		ResourceUsageService,
		ResourceUsageSummaryService,
		ResourceUsageAggregationService,
		ResourceUsageProjectMapperService,
		CollectorApiKeyGuard
	],
	exports: [ResourceUsageService, ResourceUsageProjectMapperService]
})
export class ResourceUsageModule {}
