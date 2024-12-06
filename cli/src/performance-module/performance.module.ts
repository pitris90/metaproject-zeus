import { Module } from '@nestjs/common';
import { FakeDataService } from './services/fake-data.service';

@Module({
	providers: [FakeDataService]
})
export class PerformanceModule {}
