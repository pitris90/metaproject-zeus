import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Allocation } from './allocation';
import { TimeEntity } from '../time-entity';

export interface AllocationOpenstackPayload {
	domain: string;
	disableDate?: string;
	projectDescription: string;
	mainTag: string;
	customerKey: string;
	organizationKey: string;
	workplaceKey: string;
	quota: Record<string, number>;
	additionalTags?: string[];
}

@Entity()
export class AllocationOpenstackRequest {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ name: 'allocation_id' })
	@Index({ unique: true })
	allocationId: number;

	@OneToOne(() => Allocation, (allocation) => allocation.openstackRequest, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'allocation_id' })
	allocation: Allocation;

	@Column({ type: 'varchar', length: 128 })
	resourceType: string;

	@Column({ type: 'jsonb' })
	payload: AllocationOpenstackPayload;

	@Column({ default: false })
	processed: boolean;

	@Column({ type: 'timestamptz', nullable: true })
	processedAt: Date | null;

	@Column({ nullable: true })
	mergeRequestUrl: string | null;

	@Column({ nullable: true })
	branchName: string | null;

	@Column({ nullable: true })
	yamlPath: string | null;

	@Column(() => TimeEntity)
	time: TimeEntity;
}
