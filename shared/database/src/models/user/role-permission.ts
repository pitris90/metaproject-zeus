import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Permission } from './permission';
import { TimeEntity } from '../time-entity';
import { Role } from './role';

@Entity()
@Unique(['roleId', 'permissionId'])
export class RolePermission {
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

	@Column(() => TimeEntity)
	time: TimeEntity;
}