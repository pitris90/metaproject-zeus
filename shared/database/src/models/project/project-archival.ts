import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Project } from './project';

@Entity()
export class ProjectArchival {
	@PrimaryGeneratedColumn()
	id: number;

	@OneToOne(() => Project)
	@JoinColumn()
	project: Project;

	@Column("text", { default: null, nullable: true })
	description: string;

	@Column({ default: null, nullable: true })
	reportFileName: string;

	@Column(() => TimeEntity)
	time: TimeEntity;
}