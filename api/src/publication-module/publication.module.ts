import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiPublicationService } from './services/api-publication.service';
import { PublicationSearchController } from './controllers/publication-search.controller';
import { PublicationMapper } from './mapper/publication.mapper';

@Module({
	imports: [HttpModule],
	exports: [],
	providers: [ApiPublicationService, PublicationMapper],
	controllers: [PublicationSearchController]
})
export class PublicationModule {}
