import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from './time-entity';

@Entity()
export class File {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	originalName: string;

	@Column()
	mime: string;

	@Column({ unique: true })
	path: string;

	// size in bytes
	@Column()
	size: number;

	@Column(() => TimeEntity)
	time: TimeEntity;
}