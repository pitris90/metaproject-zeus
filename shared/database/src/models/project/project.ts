import {
	BeforeInsert,
	BeforeUpdate,
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
@Index('IDX_project_personal_per_user', ['piId'], { unique: true, where: '"is_personal" = true' })
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	@Index()
	title: string;

	@Column({ unique: true })
	@Index()
	projectSlug: string;

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

	@Column({ default: false, name: 'is_personal' })
	@Index()
	isPersonal: boolean;

	@CreateDateColumn()
	@Index()
	createdAt: string;

	@UpdateDateColumn()
	updatedAt: string;

	@OneToMany(() => ProjectUser, projectUser => projectUser.project)
	members: ProjectUser[];

	@OneToOne(() => ProjectArchival, archivalInfo => archivalInfo.project)
	archivalInfo: ProjectArchival;

	@BeforeInsert()
	@BeforeUpdate()
	generateSlug() {
		if (this.title) {
			this.projectSlug = this.slugify(this.title);
		}
	}

	private slugify(value: string): string {
		if (!value) return '';

		const base = value.normalize('NFKD');
		return base
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase();
	}
}