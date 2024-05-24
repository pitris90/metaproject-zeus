import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { ProjectUser, ProjectUserRole, ProjectUserStatus, User } from 'resource-manager-database';
import { MemberRequestDto } from '../dtos/input/member-request.dto';

@Injectable()
export class MemberModel {
	public constructor(private readonly dataSource: DataSource) {}

	public async getProjectMembers(projectId: number, userId: number) {
		return this.dataSource
			.createQueryBuilder()
			.select(['pu.id', 'pu.role', 'pu.status'])
			.from(ProjectUser, 'pu')
			.innerJoinAndSelect('pu.user', 'user')
			.innerJoin('pu.project', 'project')
			.where('pu.projectId = :projectId', { projectId })
			.andWhere(
				new Brackets((qb) => {
					// is manager of current project
					qb.where('(pu.role = :managerRole AND pu.userId = :puUserId)', {
						managerRole: ProjectUserRole.MANAGER,
						puUserId: userId
					})
						// is pi of current project
						.orWhere('project.piId = :piId', { piId: userId })
						// is neither - show only active members
						.orWhere('pu.status = :activeStatus', { activeStatus: ProjectUserStatus.ACTIVE });
				})
			)
			.getMany();
	}

	public async addMember(manager: EntityManager, projectId: number, member: MemberRequestDto) {
		await manager
			.createQueryBuilder()
			.insert()
			.into(User)
			.values({
				externalId: member.id,
				source: 'perun'
			})
			.orIgnore()
			.execute();

		const user = await manager.getRepository(User).findOneOrFail({
			where: {
				externalId: member.id,
				source: 'perun'
			}
		});

		const projectRole = member.role === 'manager' ? ProjectUserRole.MANAGER : ProjectUserRole.USER;

		await manager
			.createQueryBuilder()
			.insert()
			.into(ProjectUser)
			.values({
				projectId,
				userId: user.id,
				role: projectRole,
				status: ProjectUserStatus.PENDING
			})
			.execute();
	}
}
