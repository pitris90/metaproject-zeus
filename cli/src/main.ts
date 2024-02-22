import * as process from 'process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedCommand } from './seeders-module/seed.command';

async function bootstrap() {
	const app = await NestFactory.createApplicationContext(AppModule);

	const command = process.argv[2];
	switch (command) {
		case 'seed':
			const seedCommand = app.get(SeedCommand);
			await seedCommand.run();
			break;
		default:
			throw new Error(`Command ${command} not found. Valid commands are: seed`);
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
