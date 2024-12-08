import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FakeDataService } from './services/fake-data.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { AuthorizationReportProvider } from './providers/authorization-report.provider';
import { PerformanceReportService } from './services/performance-report.service';
import { RequestProjectProvider } from './providers/request-project.provider';
import { UserProjectsProvider } from './providers/user-projects.provider';
import { ProjectDetailProvider } from './providers/project-detail.provider';

@Module({
	imports: [HttpModule],
	providers: [
		FakeDataService,
		PerformanceMonitorService,
		AuthorizationReportProvider,
		PerformanceReportService,
		RequestProjectProvider,
		UserProjectsProvider,
		ProjectDetailProvider
	]
})
export class PerformanceModule {}
