import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users-module/users.module';
import { PerunModule } from '../perun-module/perun.module';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectMapper } from './mappers/project.mapper';
import { ProjectModel } from './models/project.model';
import { ProjectApprovalController } from './controllers/project-approval.controller';
import { ProjectApprovalService } from './services/project-approval.service';
import { MembersController } from './controllers/members.controller';
import { MemberMapper } from './mappers/member.mapper';
import { MemberService } from './services/member.service';
import { MemberModel } from './models/member.model';
import { ProjectPermissionService } from './services/project-permission.service';
import { ProjectLockService } from './services/project-lock.service';

@Module({
	imports: [forwardRef(() => UsersModule), PerunModule],
	controllers: [ProjectController, ProjectApprovalController, MembersController],
	exports: [ProjectPermissionService, MemberModel],
	providers: [
		ProjectService,
		ProjectMapper,
		ProjectModel,
		MemberModel,
		ProjectLockService,
		ProjectPermissionService,
		ProjectApprovalService,
		MemberMapper,
		MemberService
	]
})
export class ProjectModule {}
