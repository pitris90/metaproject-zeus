import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission';


@Entity()
export class Role {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column()
	name: string;

	@ManyToMany(() => Permission, permission => permission.roles)
	@JoinTable({name: 'role_permissions'})
	permissions: Permission[];

	@Column({
		type: "timestamptz",
		default: () => 'CURRENT_TIMESTAMP'
	})
	createdAt: string;

	@Column({
		type: "timestamptz",
		default: () => 'CURRENT_TIMESTAMP',
	})
	updatedAt: string;
}