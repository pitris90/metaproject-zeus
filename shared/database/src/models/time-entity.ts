import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class TimeEntity {
	@CreateDateColumn()
	createdAt: string;

	@UpdateDateColumn()
	updatedAt: string;
}