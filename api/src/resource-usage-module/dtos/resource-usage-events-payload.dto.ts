import { IsArray, ValidateNested, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceUsageEventDto } from './resource-usage-event.dto';

export class ResourceUsageEventsPayloadDto {
	@ApiProperty({
		description: 'Array of resource usage events',
		type: [ResourceUsageEventDto]
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ResourceUsageEventDto)
	events: ResourceUsageEventDto[];

	@ApiPropertyOptional({
		description: 'Whether this is the last batch in the sequence (triggers aggregation)',
		example: false,
		default: false
	})
	@IsOptional()
	@IsBoolean()
	is_last_batch?: boolean;
}
