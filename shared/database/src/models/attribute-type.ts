import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from './time-entity';

@Entity()
export class AttributeType {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	name: string;

	@Column(() => TimeEntity)
	time: TimeEntity;
}