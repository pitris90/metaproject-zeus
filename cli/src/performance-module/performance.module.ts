import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FakeDataService } from './services/fake-data.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { AuthorizationReportProvider } from './providers/authorization-report.provider';
import { PerformanceReportService } from './services/performance-report.service';

@Module({
	imports: [HttpModule],
	providers: [FakeDataService, PerformanceMonitorService, AuthorizationReportProvider, PerformanceReportService]
})
export class PerformanceModule {}
