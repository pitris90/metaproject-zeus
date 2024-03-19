import { Module } from '@nestjs/common';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectMapper } from './services/project.mapper';
import { ProjectModel } from './models/project.model';
import { ProjectApprovalController } from './controllers/project-approval.controller';
import { ProjectApprovalService } from './services/project-approval.service';

@Module({
	controllers: [ProjectController, ProjectApprovalController],
	providers: [ProjectService, ProjectMapper, ProjectModel, ProjectApprovalService]
})
export class ProjectModule {}
