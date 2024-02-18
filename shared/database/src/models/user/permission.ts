import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role';


@Entity()
export class Permission {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column("text")
	description: string;

	@ManyToMany(() => Role, role => role.permissions)
	roles: Role[];

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