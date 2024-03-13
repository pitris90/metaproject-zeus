import { Module } from '@nestjs/common';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectMapper } from './services/project.mapper';
import { ProjectModel } from './models/project.model';

@Module({
	controllers: [ProjectController],
	providers: [ProjectService, ProjectMapper, ProjectModel]
})
export class ProjectModule {}
