import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from '../config/validationSchema.config';

@Module({
	imports: [
		ConfigModule.forRoot({
			validationSchema,
			isGlobal: true
		})
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
