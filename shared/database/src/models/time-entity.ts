import { Column } from 'typeorm';

export class TimeEntity {
	@Column({
		name: "createdAt",
		type: "timestamptz",
		default: () => 'CURRENT_TIMESTAMP',
	})
	createdAt: string;

	@Column({
		name: "updatedAt",
		type: "timestamptz",
		default: () => 'CURRENT_TIMESTAMP',
	})
	updatedAt: string;
}