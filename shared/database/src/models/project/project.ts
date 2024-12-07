import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm';
import { User } from '../user/user';
import { ProjectUser } from './project-user';
import { ProjectArchival } from './project-archival';

export enum ProjectStatus {
	NEW = "new",
	ACTIVE = "active",
	REJECTED = "rejected",
	ARCHIVED = "archived"
}

@Entity()
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	@Index()
	title: string;

	@Column({ nullable: true })
	link: string;

	@ManyToOne(() => User, user => user.assignedProjects)
	pi: User;

	@Column({ nullable: false })
	@Index()
	piId: number;

	@Column("text")
	description: string;

	/**
	 * Perun ID of the project group.
	 * Added when group is created in Perun.
	 */
	@Column({ nullable: true, default: null, unique: true })
	perunId: number;

	@Column()
	status: ProjectStatus;

	@CreateDateColumn()
	@Index()
	createdAt: string;

	@UpdateDateColumn()
	updatedAt: string;

	@OneToMany(() => ProjectUser, projectUser => projectUser.project)
	members: ProjectUser[];

	@OneToOne(() => ProjectArchival, archivalInfo => archivalInfo.project)
	archivalInfo: ProjectArchival;
}