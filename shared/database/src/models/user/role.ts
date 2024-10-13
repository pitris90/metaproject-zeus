import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { User } from './user';


@Entity()
export class Role {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column()
	name: string;

	@OneToMany(() => User, user => user.role)
	users: User[];

	@Column(() => TimeEntity)
	time: TimeEntity;
}