import * as process from 'process';
import { NestFactory } from '@nestjs/core';
import * as minimist from 'minimist';
import { AppModule } from './app.module';
import { SeedCommand } from './seeders-module/seed.command';
import { FakeDataService } from './performance-module/services/fake-data.service';
import { PerformanceReportService } from './performance-module/services/performance-report.service';
import { ResourceUsageUserFakerService } from './performance-module/services/resource-usage-user-faker.service';

async function bootstrap() {
	const app = await NestFactory.createApplicationContext(AppModule);

	const command = process.argv[2];
	const argv = minimist(process.argv.slice(2));
	switch (command) {
		case 'seed':
			const seedCommand = app.get(SeedCommand);
			await seedCommand.run();
			break;
		case 'generate':
			const count = argv['count'] ?? 1;
			const fakeDataService = app.get(FakeDataService);
			await fakeDataService.generate(count);
			break;
		case 'report':
			const performanceReportService = app.get(PerformanceReportService);
			await performanceReportService.generateReport();
			break;
		case 'fake-usage-users':
			const usageFaker = app.get(ResourceUsageUserFakerService);
			await usageFaker.syncFromResourceUsage();
			break;
		default:
			throw new Error(`Command ${command} not found. Valid commands are: seed, generate, report, fake-usage-users`);
	}

	await app.close();
	process.exit(0);
}

bootstrap()
	.then(() => {
		console.info('Command is running...');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Server failed to start', err);
		process.exit(1);
	});
