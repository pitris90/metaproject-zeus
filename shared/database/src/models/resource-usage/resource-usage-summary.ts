import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../project/project';

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

	// Aggregated metrics
	@Column({ type: 'numeric', nullable: false, default: 0, name: 'cpu_time_seconds' })
	cpuTimeSeconds: number;

	@Column({ type: 'numeric', nullable: false, default: 0, name: 'walltime_seconds' })
	walltimeSeconds: number;

	@Column({ type: 'numeric', nullable: true, name: 'cpu_percent_avg' })
	cpuPercentAvg: number | null;

	@Column({ type: 'bigint', nullable: false, default: 0, name: 'ram_bytes_allocated' })
	ramBytesAllocated: number;

	@Column({ type: 'bigint', nullable: false, default: 0, name: 'ram_bytes_used' })
	ramBytesUsed: number;

	@Column({ type: 'bigint', nullable: true, name: 'storage_bytes_allocated' })
	storageBytesAllocated: number | null;

	@Column({ type: 'integer', nullable: true, name: 'vcpus_allocated' })
	vcpusAllocated: number | null;

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
