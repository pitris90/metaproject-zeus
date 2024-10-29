import { Column, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
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
@Unique(["title", "pi"])
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	title: string;

	@Column({ nullable: true })
	link: string;

	@ManyToOne(() => User, user => user.assignedProjects)
	pi: User;

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

	@Column(() => TimeEntity)
	time: TimeEntity;

	@OneToMany(() => ProjectUser, projectUser => projectUser.project)
	members: ProjectUser[];

	@OneToOne(() => ProjectArchival, archivalInfo => archivalInfo.project)
	archivalInfo: ProjectArchival;
}