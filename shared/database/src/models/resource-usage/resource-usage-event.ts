import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

@Entity('resource_usage_events')
@Hypertable({
  compression: {
    compress: true,
    compress_orderby: 'time_window_start',
    compress_segmentby: 'source',
    policy: {
      schedule_interval: '7 days',
    },
  },
})
@Index(['source', 'time_window_start'])
export class ResourceUsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @TimeColumn()
  time_window_start: Date;

  @Column({ type: 'timestamptz', nullable: false })
  time_window_end: Date;

  @Column({ type: 'timestamptz', nullable: false })
  collected_at: Date;

  @Column({ type: 'text', nullable: false })
  schema_version: string;

  @Column({ type: 'text', nullable: false })
  source: string;

  @Column({ type: 'jsonb', nullable: false })
  metrics: {
    cpu_time_seconds: number;
    gpu_time_seconds?: number;
    ram_bytes_allocated?: number;
    ram_bytes_used?: number;
    storage_bytes_allocated?: number;
    vcpus_allocated?: number;
    used_cpu_percent?: number;
    walltime_allocated?: number;
    walltime_used?: number;
  };

  @Column({ type: 'jsonb', nullable: false })
  identities: {
    scheme: string;
    value: string;
    authority?: string;
  }[];

  @Column({ type: 'jsonb', nullable: false })
  context: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, any> | null;
}
