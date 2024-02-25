import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { User } from './user';
import { RolePermission } from './role-permission';


@Entity()
export class Role extends TimeEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column()
	name: string;

	@OneToMany(() => User, user => user.role)
	users: User[];

	@OneToMany(() => RolePermission, rolePermission => rolePermission.role)
	permissionsToRole: RolePermission[];
}