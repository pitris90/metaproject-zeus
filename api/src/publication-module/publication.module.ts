import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProjectModule } from '../project-module/project.module';
import { ApiConfigModule } from '../config-module/api-config.module';
import { ApiPublicationService } from './services/api-publication.service';
import { PublicationSearchController } from './controllers/publication-search.controller';
import { PublicationMapper } from './mapper/publication.mapper';
import { PublicationService } from './services/publication.service';
import { PublicationController } from './controllers/publication.controller';
import { UserPublicationController } from './controllers/user-publication.controller';
import { PublicationModel } from './models/publication.model';

@Module({
	imports: [HttpModule, ProjectModule, ApiConfigModule],
	exports: [],
	providers: [ApiPublicationService, PublicationMapper, PublicationService, PublicationModel],
	controllers: [PublicationSearchController, PublicationController, UserPublicationController]
})
export class PublicationModule {}
