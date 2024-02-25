import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Role } from './role';

@Entity()
@Unique("externalLogin", ["source", "externalId"])
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({enum: ['perun']})
	source: string;

	@Column({unsigned: true})
	externalId: number;

	@Column()
	username: string;

	@ManyToOne(() => Role, role => role.users)
	role: Role;

	@Column(() => TimeEntity)
	time: TimeEntity;
}