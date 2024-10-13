import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { AllocationStatus } from '../../enums/allocation.status';
import { Allocation } from './allocation';
import { User } from '../user/user';

@Entity()
@Unique(['allocationId', 'userId', 'status'])
export class AllocationUser {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	allocationId: number;

	@Column()
	userId: number;

	@Column()
	status: AllocationStatus;

	@ManyToOne(() => Allocation)
	allocation: Allocation;

	@ManyToOne(() => User)
	user: User;

	@Column(() => TimeEntity)
	time: TimeEntity;
}