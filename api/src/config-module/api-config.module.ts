import { Module } from '@nestjs/common';
import { ApiConfigService } from './api-config.service';
import { TypeormConfigService } from './database/typeorm.config';

@Module({
	providers: [ApiConfigService, TypeormConfigService],
	exports: [ApiConfigService, TypeormConfigService]
})
export class ApiConfigModule {}