import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project';
import { TimeEntity } from '../time-entity';

/**
 * Contains information if Perun group creation failed on some stage so it can be repaired by admin (or retried automatically).
 */
@Entity()
export class GroupFailedStage {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	lastStage: string;

	@Column({ nullable: true })
	message: string;

	@Column({ default: false })
	isRunning: boolean;

	@Column({ unique: true })
	@Index()
	projectId: number;

	@ManyToOne(() => Project)
	project: Project;

	@Column(() => TimeEntity)
	time: TimeEntity;
}