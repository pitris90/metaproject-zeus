import { Module } from '@nestjs/common';
import { PaginationMapper } from './mappers/pagination.mapper';

@Module({
	providers: [PaginationMapper],
	exports: [PaginationMapper]
})
export class ApiConfigModule {}
