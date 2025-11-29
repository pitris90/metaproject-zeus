import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Allocation } from './allocation';
import { TimeEntity } from '../time-entity';

/**
 * Network ACL configuration for OpenStack project.
 * Networks can be assigned to access_as_external and/or access_as_shared.
 */
export interface AllocationOpenstackNetworks {
	accessAsExternal?: string[];
	accessAsShared?: string[];
}

export interface AllocationOpenstackPayload {
	domain: string;
	disableDate?: string;
	projectDescription: string;
	customerKey: string;
	organizationKey: string;
	workplaceKey: string;
	quota: Record<string, number>;
	additionalTags?: string[];
	/** Optional list of non-public flavor names to assign to the project */
	flavors?: string[];
	/** Optional network ACL configuration */
	networks?: AllocationOpenstackNetworks;
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
