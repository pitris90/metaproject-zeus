import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { User } from '../user/user';

export enum ProjectStatus {
	NEW = "new",
	ACTIVE = "active",
	INACTIVE = "inactive"
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
}