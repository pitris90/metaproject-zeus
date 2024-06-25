import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { User } from '../user/user';
import { ProjectUser } from './project-user';

export enum ProjectStatus {
	NEW = "new",
	ACTIVE = "active",
	REJECTED = "rejected",
	ARCHIVED = "archived"
}

@Entity()
@Unique(["title", "pi"])
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	title: string;

	@ManyToOne(() => User, user => user.assignedProjects)
	pi: User;

	@Column("text")
	description: string;

	@Column()
	status: ProjectStatus;

	@Column(() => TimeEntity)
	time: TimeEntity;

	@OneToMany(() => ProjectUser, projectUser => projectUser.project)
	members: ProjectUser[];
}