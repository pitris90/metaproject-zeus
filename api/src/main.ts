import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiConfigService } from './config-module/api-config.service';
import { ApplicationMode } from './config-module/config-options/application-mode.enum';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ApiConfigService);

	app.enableCors({
		origin: configService.corsOrigin
	});

	if (configService.applicationMode === ApplicationMode.DEVELOPMENT) {
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
