import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Role } from './role';
import { Project } from '../project/project';
import { ProjectUser } from '../project/project-user';

@Entity()
@Unique("externalLogin", ["source", "externalId"])
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({enum: ['perun']})
	source: string;

	@Column({unsigned: true})
	externalId: number;

	@Column()
	username: string;

	@Column()
	name: string;

	@ManyToOne(() => Role, role => role.users)
	role: Role;

	@OneToMany(() => Project, project => project.pi)
	assignedProjects: Project[];

	@Column(() => TimeEntity)
	time: TimeEntity;

	@OneToMany(() => ProjectUser, projectUser => projectUser.user)
	memberships: ProjectUser[];
}