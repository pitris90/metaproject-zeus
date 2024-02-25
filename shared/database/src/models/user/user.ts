import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';

@Entity()
@Unique("externalLogin", ["source", "externalId"])
export class User extends TimeEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({enum: ['perun']})
	source: string;

	@Column({unsigned: true})
	externalId: number;

	@Column()
	username: string;
}