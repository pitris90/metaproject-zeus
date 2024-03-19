import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { User } from '../user/user';
import { Project } from './project';

export enum ApprovalStatus {
	APPROVED = "approved",
	REJECTED = "rejected"
}

@Entity()
@Unique(["project", "reviewer"])
export class ProjectApproval {
	@PrimaryGeneratedColumn()
	id: number;

	@OneToOne(() => Project)
	@JoinColumn()
	project: Project;

	@ManyToOne(() => User)
	@JoinColumn({ name: "reviewerId" })
	reviewer: User;

	@Column()
	reviewerId: number;

	@Column("text", { default: null, nullable: true })
	description: string | null;

	@Column()
	status: ApprovalStatus;

	@Column(() => TimeEntity)
	time: TimeEntity;
}