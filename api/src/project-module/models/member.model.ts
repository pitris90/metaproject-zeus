import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProjectUser, ProjectUserRole, ProjectUserStatus, User } from 'resource-manager-database';
import { PerunUser } from '../../perun-module/entities/perun-user.entity';
import { Pagination } from '../../config-module/decorators/get-pagination';

@Injectable()
export class MemberModel {
	public constructor(private readonly dataSource: DataSource) {}

	public async getProjectMembers(projectId: number, showAllMembers: boolean, pagination: Pagination) {
		const projectMemberBuilder = this.dataSource
			.createQueryBuilder()
			.select(['pu.id', 'pu.role', 'pu.status'])
			.from(ProjectUser, 'pu')
			.innerJoinAndSelect('pu.user', 'user')
			.innerJoin('pu.project', 'project')
			.where('pu.projectId = :projectId', { projectId });

		if (!showAllMembers) {
			// show only active members
			projectMemberBuilder.andWhere('pu.status = :status', { status: ProjectUserStatus.ACTIVE });
		}

		projectMemberBuilder.offset(pagination.offset).limit(pagination.limit);

		return projectMemberBuilder.getManyAndCount();
	}

	public async addMember(manager: EntityManager, projectId: number, member: PerunUser, role: string) {
		await manager
			.createQueryBuilder()
			.insert()
			.into(User)
			.values({
				externalId: member.id,
				source: 'perun',
				username: member.username,
				name: member.name
				// TODO load role from Perun
			})
			.orIgnore()
			.execute();

		const user = await manager.getRepository(User).findOneOrFail({
			where: {
				externalId: member.id,
				source: 'perun'
			}
		});

		const projectRole = role === 'manager' ? ProjectUserRole.MANAGER : ProjectUserRole.USER;

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

	public async deleteMember(projectId: number, userId: number) {
		await this.dataSource
			.createQueryBuilder()
			.delete()
			.from(ProjectUser)
			.where('projectId = :projectId AND id = :userId', { projectId, userId })
			.execute();
	}
}
