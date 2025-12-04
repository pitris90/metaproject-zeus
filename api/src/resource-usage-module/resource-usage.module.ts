import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	Allocation,
	AllocationOpenstackRequest,
	Project,
	ResourceUsageEvent,
	ResourceUsageSummary,
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
import { ResourceUsageDownsamplingService } from './services/resource-usage-downsampling.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ResourceUsageEvent,
			ResourceUsageSummary,
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
		ResourceUsageDownsamplingService,
		CollectorApiKeyGuard
	],
	exports: [ResourceUsageService, ResourceUsageProjectMapperService]
})
export class ResourceUsageModule {}
