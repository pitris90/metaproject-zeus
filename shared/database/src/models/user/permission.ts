import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role';
import { TimeEntity } from '../time-entity';


@Entity()
export class Permission extends TimeEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column("text")
	description: string;

	@ManyToMany(() => Role, role => role.permissions)
	roles: Role[];
}