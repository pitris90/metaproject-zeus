import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResourceUsageMetricsDto {
	@ApiProperty({
		description: 'Total CPU time consumed in seconds',
		example: 3600
	})
	@IsInt()
	@Min(0)
	cpu_time_seconds: number;

	@ApiPropertyOptional({
		description: 'Total GPU time consumed in seconds',
		example: 1800
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	gpu_time_seconds?: number;

	@ApiPropertyOptional({
		description: 'RAM allocated in bytes',
		example: 8589934592
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	ram_bytes_allocated?: number;

	@ApiPropertyOptional({
		description: 'RAM actually used in bytes',
		example: 6442450944
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	ram_bytes_used?: number;

	@ApiPropertyOptional({
		description: 'Storage allocated in bytes',
		example: 107374182400
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	storage_bytes_allocated?: number;

	@ApiPropertyOptional({
		description: 'Virtual CPUs allocated',
		example: 4
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	vcpus_allocated?: number;

	@ApiPropertyOptional({
		description: 'Average CPU utilization percent',
		example: 75
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	used_cpu_percent?: number;

	@ApiPropertyOptional({
		description: 'Requested walltime in seconds',
		example: 7200
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	walltime_allocated?: number;

	@ApiPropertyOptional({
		description: 'Actual walltime consumed in seconds',
		example: 6800
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	walltime_used?: number;
}
