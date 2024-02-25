import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission';
import { TimeEntity } from '../time-entity';
import { User } from './user';


@Entity()
export class Role extends TimeEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column()
	name: string;

	@ManyToMany(() => Permission, permission => permission.roles)
	@JoinTable({name: 'role_permissions'})
	permissions: Permission[];

	@OneToMany(() => User, user => user.role)
	users: User[];
}