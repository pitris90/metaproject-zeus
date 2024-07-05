import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	const applicationMode = configService.get('APPLICATION_MODE');
	const isDevelopmentMode = applicationMode === 'development';

	AppService.APP_ROOT = applicationMode === 'test' ? '' : path.join(path.resolve(__dirname), '..', '..');

	// register validation pipe to protect all endpoints
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			disableErrorMessages: !isDevelopmentMode
		})
	);

	app.enableCors({
		origin: configService.get('CORS_ALLOW_ORIGIN').split(',')
	});

	app.use(json({ limit: '10mb' }));

	if (isDevelopmentMode) {
		const swaggerConfig = new DocumentBuilder()
			.setTitle('Resource manager')
			.setDescription('Resource manager backend API')
			.setVersion('1.0')
			.addTag('resource-manager')
			.build();
		const document = SwaggerModule.createDocument(app, swaggerConfig);
		SwaggerModule.setup('apidoc', app, document);
	}

	await app.listen(3000);
}
bootstrap();
