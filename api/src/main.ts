import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiConfigService } from './config-module/api-config.service';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ApiConfigService);

	app.enableCors({
		origin: configService.corsOrigin
	});

	await app.listen(3000);
}
bootstrap();
