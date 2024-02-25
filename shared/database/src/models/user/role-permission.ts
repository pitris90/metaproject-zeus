import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission';
import { TimeEntity } from '../time-entity';
import { Role } from './role';

@Entity()
export class RolePermission extends TimeEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	roleId: number;

	@Column()
	permissionId: number;

	@ManyToOne(() => Permission, permission => permission.permissionsToRole)
	permission: Permission;

	@ManyToOne(() => Role, role => role.permissionsToRole)
	role: Role;
}