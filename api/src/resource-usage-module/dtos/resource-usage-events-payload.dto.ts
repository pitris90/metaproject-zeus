import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceUsageEventDto } from './resource-usage-event.dto';

export class ResourceUsageEventsPayloadDto {
  @ApiProperty({
    description: 'Array of resource usage events',
    type: [ResourceUsageEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceUsageEventDto)
  events: ResourceUsageEventDto[];
}
