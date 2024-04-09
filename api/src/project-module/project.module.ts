import { Module } from '@nestjs/common';
import { UsersModule } from '../users-module/users.module';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectMapper } from './mappers/project.mapper';
import { ProjectModel } from './models/project.model';
import { ProjectApprovalController } from './controllers/project-approval.controller';
import { ProjectApprovalService } from './services/project-approval.service';
import { MembersController } from './controllers/members.controller';
import { MemberMapper } from './mappers/member.mapper';
import { MemberService } from './services/member.service';

@Module({
	imports: [UsersModule],
	controllers: [ProjectController, ProjectApprovalController, MembersController],
	providers: [ProjectService, ProjectMapper, ProjectModel, ProjectApprovalService, MemberMapper, MemberService]
})
export class ProjectModule {}
