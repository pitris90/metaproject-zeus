import { Module } from '@nestjs/common';
import { PerunModule } from '../perun-module/perun.module';
import { UsersModel } from './models/users.model';
import { UserMapper } from './services/user.mapper';

@Module({
	imports: [PerunModule],
	providers: [UsersModel, UserMapper],
	exports: [UsersModel, UserMapper]
})
export class UsersModule {}
