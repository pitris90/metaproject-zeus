import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Project } from '../project/project';

export type PublicationSource = 'manual' | 'doi';

@Entity()
@Unique(['uniqueId', 'projectId'])
export class Publication {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({
		length: 1024
	})
	title: string;

	@Column({
		length: 1024
	})
	author: string;

	@Column({ unsigned: true })
	year: number;

	@Column()
	uniqueId: string;

	@Column()
	journal: string;

	@Column()
	source: PublicationSource;

	@Column()
	projectId: number;

	@ManyToOne(() => Project)
	project: Project;

	@Column(() => TimeEntity)
	time: TimeEntity;
}