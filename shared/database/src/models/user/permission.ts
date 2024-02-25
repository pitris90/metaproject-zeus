import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolePermission } from './role-permission';
import { TimeEntity } from '../time-entity';


@Entity()
export class Permission {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column("text")
	description: string;

	@OneToMany(() => RolePermission, rolePermission => rolePermission.permission)
	permissionsToRole: RolePermission[];

	@Column(() => TimeEntity)
	time: TimeEntity;
}