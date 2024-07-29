import * as path from 'node:path';
import { forwardRef, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users-module/users.module';
import { PerunModule } from '../perun-module/perun.module';
import { AppService } from '../app.service';
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
import { ProjectArchivalService } from './services/project-archival.service';
import { ProjectArchiveController } from './controllers/project-archive.controller';
import { ProjectFileController } from './controllers/project-file.controller';

@Module({
	imports: [
		forwardRef(() => UsersModule),
		PerunModule,
		MulterModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => {
				const destination = configService.get<string>('FILE_UPLOAD_FOLDER');

				if (!destination) {
					throw new Error('FILE_UPLOAD_FOLDER not set in configuration');
				}

				return {
					dest: path.join(AppService.APP_ROOT, destination)
				};
			},
			inject: [ConfigService]
		})
	],
	controllers: [
		ProjectController,
		ProjectApprovalController,
		MembersController,
		ProjectArchiveController,
		ProjectFileController
	],
	exports: [ProjectPermissionService, MemberModel, ProjectModel],
	providers: [
		ProjectService,
		ProjectMapper,
		ProjectModel,
		MemberModel,
		ProjectLockService,
		ProjectPermissionService,
		ProjectApprovalService,
		ProjectArchivalService,
		MemberMapper,
		MemberService
	]
})
export class ProjectModule {}
