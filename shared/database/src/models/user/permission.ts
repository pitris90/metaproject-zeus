import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { RolePermission } from './role-permission';


@Entity()
export class Permission extends TimeEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column("text")
	description: string;

	@OneToMany(() => RolePermission, rolePermission => rolePermission.permission)
	permissionsToRole: RolePermission[];
}