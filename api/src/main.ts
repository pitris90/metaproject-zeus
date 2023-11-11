import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);

	app.enableCors({
		origin: configService.get('CORS_ALLOW_ORIGIN').split(',')
	});

	if (configService.get('APPLICATION_MODE') === 'development') {
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
