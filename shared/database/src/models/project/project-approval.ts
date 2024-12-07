import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { User } from '../user/user';
import { Project } from './project';

export enum ApprovalStatus {
	APPROVED = "approved",
	REJECTED = "rejected"
}

@Entity()
export class ProjectApproval {
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne(() => Project)
	@JoinColumn()
	project: Project;

	@Column()
	@Index()
	projectId: number;

	@ManyToOne(() => User)
	@JoinColumn({ name: "reviewer_id" })
	reviewer: User;

	@Column()
	@Index()
	reviewerId: number;

	@Column("text", { default: null, nullable: true })
	description: string | null;

	@Column()
	status: ApprovalStatus;

	@Column(() => TimeEntity)
	time: TimeEntity;
}