import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Project } from './project';
import { User } from '../user/user';

export enum ProjectUserRole {
	USER = "user",
	MANAGER = "manager"
}

export enum ProjectUserStatus {
	ACTIVE = "active",
	PENDING = "pending",
	DENIED = "denied",
	REMOVED = "removed"
}

@Entity()
@Unique(["projectId", "userId"])
export class ProjectUser {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	@Index()
	projectId: number;

	@Column()
	@Index()
	userId: number;

	@Column()
	role: ProjectUserRole;

	@Column()
	status: ProjectUserStatus;

	@Column(() => TimeEntity)
	time: TimeEntity;

	@ManyToOne(() => Project, project => project.members)
	project: Project;

	@ManyToOne(() => User)
	user: User;
}