import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	const isDevelopmentMode = configService.get('APPLICATION_MODE') === 'development';

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
