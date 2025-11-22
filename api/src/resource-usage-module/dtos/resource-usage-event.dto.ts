import {
  IsString,
  IsDateString,
  IsObject,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceUsageMetricsDto } from './resource-usage-metrics.dto';

export enum ResourceUsageSource {
  PBS = 'pbs',
  OPENSTACK = 'openstack',
}

export class ResourceIdentityDto {
  @ApiProperty({
    description: 'Identifier scheme, e.g., perun_user',
    example: 'perun_user',
  })
  @IsString()
  scheme: string;

  @ApiProperty({
    description: 'Identifier value',
    example: 'user123',
  })
  @IsString()
  value: string;

  @ApiPropertyOptional({
    description: 'Authority issuing the identity',
    example: 'perun.cesnet.cz',
  })
  @IsOptional()
  @IsString()
  authority?: string;
}

export class ResourceUsageEventDto {
  @ApiProperty({
    description: 'Schema version for compatibility',
    example: '1.0',
    default: '1.0',
  })
  @IsString()
  schema_version: string = '1.0';

  @ApiProperty({
    description: 'Data source identifier',
    enum: ResourceUsageSource,
    example: ResourceUsageSource.PBS,
  })
  @IsEnum(ResourceUsageSource)
  source: ResourceUsageSource;

  @ApiProperty({
    description: 'Start of the measurement window',
    example: '2025-11-19T00:00:00Z',
  })
  @IsDateString()
  time_window_start: string;

  @ApiProperty({
    description: 'End of the measurement window',
    example: '2025-11-20T00:00:00Z',
  })
  @IsDateString()
  time_window_end: string;

  @ApiProperty({
    description: 'Timestamp when data was collected',
    example: '2025-11-20T01:00:00Z',
  })
  @IsDateString()
  collected_at: string;

  @ApiProperty({
    description: 'Resource usage metrics',
    type: ResourceUsageMetricsDto,
  })
  @ValidateNested()
  @Type(() => ResourceUsageMetricsDto)
  metrics: ResourceUsageMetricsDto;

  @ApiProperty({
    description: 'List of identities the usage belongs to',
    type: [ResourceIdentityDto],
    example: [
      {
        scheme: 'perun_user',
        value: 'user123',
        authority: 'perun.cesnet.cz',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceIdentityDto)
  identities: ResourceIdentityDto[] = [];

  @ApiProperty({
    description:
      'Additional contextual information (e.g., project identifiers, job metadata, cloud region)',
    example: { project: 'project-123', jobname: '12345.meta', region: 'brno' },
  })
  @IsObject()
  context: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Extra data for debugging or future use',
    example: { debug_info: 'sample' },
  })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}
