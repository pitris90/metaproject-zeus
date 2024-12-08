import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Project } from './project';
import { File } from '../file';

@Entity()
export class ProjectArchival {
	@PrimaryGeneratedColumn()
	id: number;

	@OneToOne(() => Project)
	@JoinColumn()
	project: Project;

	@Column()
	@Index()
	projectId: number;

	@Column("text", { default: null, nullable: true })
	description: string;

	@OneToOne(() => File, { nullable: true })
	@JoinColumn()
	reportFile: File;

	@Column({ nullable: true })
	reportFileId: number;

	@Column(() => TimeEntity)
	time: TimeEntity;
}