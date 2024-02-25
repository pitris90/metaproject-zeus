import { Column } from 'typeorm';

export class TimeEntity {
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