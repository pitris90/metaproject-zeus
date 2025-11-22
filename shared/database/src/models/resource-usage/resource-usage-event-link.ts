import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm';
import { ResourceUsageEvent } from './resource-usage-event';
import { User } from '../user/user';
import { Project } from '../project/project';
import { Allocation } from '../allocation/allocation';

@Entity('resource_usage_event_links')
@Index('idx_resource_usage_event_link_event', ['eventId'])
export class ResourceUsageEventLink {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'uuid', name: 'event_id' })
	@Index()
	eventId: string;

	@ManyToOne(() => ResourceUsageEvent, { createForeignKeyConstraints: false })
	@JoinColumn({ name: 'event_id', referencedColumnName: 'id' })
	event: ResourceUsageEvent;

	@Column({ nullable: true, name: 'user_id' })
	@Index()
	userId: number | null;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'user_id' })
	user?: User | null;

	@Column({ nullable: true, name: 'project_id' })
	@Index()
	projectId: number | null;

	@ManyToOne(() => Project, { nullable: true })
	@JoinColumn({ name: 'project_id' })
	project?: Project | null;

	@Column({ nullable: true, name: 'allocation_id' })
	@Index()
	allocationId: number | null;

	@ManyToOne(() => Allocation, { nullable: true })
	@JoinColumn({ name: 'allocation_id' })
	allocation?: Allocation | null;

	@Column({ type: 'varchar', length: 64, nullable: true, name: 'user_match_scheme' })
	userMatchScheme: string | null;

	@Column({ type: 'varchar', length: 64, nullable: true, name: 'project_match_strategy' })
	projectMatchStrategy: string | null;

	@Column({ type: 'varchar', length: 64, nullable: true, name: 'allocation_match_strategy' })
	allocationMatchStrategy: string | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt: Date;
}
