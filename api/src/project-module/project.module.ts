import { Module } from '@nestjs/common';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectMapper } from './services/project.mapper';

@Module({
	controllers: [ProjectController],
	providers: [ProjectService, ProjectMapper]
})
export class ProjectModule {}
