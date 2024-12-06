import { Injectable } from '@nestjs/common';
import { ReportProvider } from '../providers/report-provider.interface';
import { AuthorizationReportProvider } from '../providers/authorization-report.provider';
import { RequestProjectProvider } from '../providers/request-project.provider';
import { UserProjectsProvider } from '../providers/user-projects.provider';
import { ProjectDetailProvider } from '../providers/project-detail.provider';
import { PerformanceMonitorService } from './performance-monitor.service';

@Injectable()
export class PerformanceReportService {
	private readonly reportProviders: ReportProvider[] = [];

	constructor(
		private readonly performanceMonitor: PerformanceMonitorService,
		readonly authorizationReportProvider: AuthorizationReportProvider,
		readonly userProjectsProvider: UserProjectsProvider,
		readonly projectDetailProvider: ProjectDetailProvider,
		readonly requestProjectProvider: RequestProjectProvider
	) {
		this.reportProviders = [
			authorizationReportProvider,
			userProjectsProvider,
			projectDetailProvider,
			requestProjectProvider
		];
	}

	async generateReport(): Promise<void> {
		const table: string[] = [];
		for (const provider of this.reportProviders) {
			const results = await this.performanceMonitor.monitor(provider);
			table.push(
				`Endpoint: ${provider.getTemplate()} (${provider.getMethod()}), Min: ${Math.ceil(results.minResponseTimeMs)}ms, Max: ${Math.ceil(results.maxResponseTimeMs)}ms, Avg: ${Math.ceil(results.averageResponseTimeMs)}ms, Response times (ms): [${results.responseTimesMs.map((t) => Math.ceil(t)).join(', ')}]`
			);
		}

		console.log(table.join('\n'));
	}
}
