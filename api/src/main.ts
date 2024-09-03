import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import * as session from 'express-session';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
	AppService.APP_ROOT = path.join(path.resolve(__dirname), '..', '..');

	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	const applicationMode = configService.get('APPLICATION_MODE');
	const isDevelopmentMode = applicationMode === 'development';

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

	const sessionSecret = configService.get('SESSION_SECRET');

	if (!sessionSecret) {
		throw new Error('SESSION_SECRET is required');
	}

	// session secret
	// TODO use redis storage for production, memory storage is default and does not scale well
	app.use(
		session({
			secret: sessionSecret,
			resave: false,
			saveUninitialized: false
		})
	);

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
