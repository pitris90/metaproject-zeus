import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiPublicationService } from './services/api-publication.service';
import { PublicationSearchController } from './controllers/publication-search.controller';

@Module({
	imports: [HttpModule],
	exports: [],
	providers: [ApiPublicationService],
	controllers: [PublicationSearchController]
})
export class PublicationModule {}
