import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../project/project';

/**
 * Interface for the JSONB metrics object in ResourceUsageSummary.
 * Matches the structure used in ResourceUsageEvent.metrics for consistency.
 */
export interface ResourceUsageSummaryMetrics {
	cpu_time_seconds: number;
	walltime_seconds: number;
	cpu_percent_avg?: number | null;
	ram_bytes_allocated: number;
	ram_bytes_used: number;
	storage_bytes_allocated?: number | null;
	vcpus_allocated?: number | null;
	gpu_time_seconds?: number;
}

@Entity('resource_usage_summaries')
@Index(['projectId', 'source', 'timeWindowStart'])
@Index(['projectSlug', 'source', 'timeWindowStart'])
@Index(['source', 'timeWindowStart'])
export class ResourceUsageSummary {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'timestamptz', nullable: false, name: 'time_window_start' })
	timeWindowStart: Date;

	@Column({ type: 'timestamptz', nullable: false, name: 'time_window_end' })
	timeWindowEnd: Date;

	@Column({ type: 'text', nullable: false })
	source: string;

	@Column({ type: 'text', nullable: true, name: 'project_slug' })
	projectSlug: string | null;

	@Column({ type: 'boolean', nullable: false, default: false, name: 'is_personal' })
	isPersonal: boolean;

	@Column({ type: 'integer', nullable: true, name: 'project_id' })
	projectId: number | null;

	@ManyToOne(() => Project, { createForeignKeyConstraints: false })
	@JoinColumn({ name: 'project_id' })
	project: Project;

	// Aggregated metrics stored as JSONB (matching ResourceUsageEvent structure)
	@Column({ type: 'jsonb', nullable: false })
	metrics: ResourceUsageSummaryMetrics;

	@Column({ type: 'integer', nullable: false, default: 0, name: 'event_count' })
	eventCount: number;

	@Column({ type: 'jsonb', nullable: false })
	identities: {
		scheme: string;
		value: string;
		authority?: string;
	}[];

	@Column({ type: 'timestamptz', nullable: false, name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
	createdAt: Date;

	@Column({ type: 'timestamptz', nullable: false, name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
	updatedAt: Date;
}
