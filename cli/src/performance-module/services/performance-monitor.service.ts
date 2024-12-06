import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { PerformanceSchema } from '../schemas/performance.schema';
import { ReportProvider } from '../providers/report-provider.interface';

const CALL_COUNT = 5;

@Injectable()
export class PerformanceMonitorService {
	private readonly logger = new Logger(PerformanceMonitorService.name);

	private readonly apiUrl: string;

	constructor(
		private readonly configService: ConfigService,
		private readonly httpService: HttpService
	) {
		this.apiUrl = this.configService.getOrThrow('API_URL');
	}

	async monitor(reportProvider: ReportProvider): Promise<PerformanceSchema> {
		const responseTimesMs: number[] = [];

		this.logger.log(`Monitoring...`);
		for (let i = 0; i < CALL_COUNT; i++) {
			const route = await reportProvider.getEndpoint();
			const headers = await reportProvider.getHeaders();
			const method = reportProvider.getMethod();
			const body = reportProvider.getBody();

			const http$ = this.httpService.request({
				url: `${this.apiUrl}${route}`,
				method: method,
				data: body,
				headers
			});

			const start = performance.now();
			await lastValueFrom(http$);
			const end = performance.now();

			responseTimesMs.push(end - start);
		}

		const avg = responseTimesMs.reduce((acc, curr) => acc + curr, 0) / CALL_COUNT;
		const max = Math.max(...responseTimesMs);
		const min = Math.min(...responseTimesMs);

		return {
			minResponseTimeMs: min,
			maxResponseTimeMs: max,
			averageResponseTimeMs: avg,
			responseTimesMs
		};
	}
}
