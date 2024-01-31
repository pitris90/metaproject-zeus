import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';


@Entity()
export class Permission {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({unique: true})
	codeName: string;

	@Column("text")
	description: string;

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