import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Project } from './project';
import { User } from '../user/user';
import { Unique } from 'typeorm/browser';

export enum ProjectUserRole {
	USER = "user",
	MANAGER = "manager"
}

export enum ProjectUserStatus {
	ACTIVE = "active",
	PENDING = "pending",
	DENIED = "denied"
}

@Entity()
@Unique(["projectId", "userId"])
export class ProjectUser {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	projectId: number;

	@Column()
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