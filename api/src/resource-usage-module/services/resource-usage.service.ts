import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageEvent } from 'resource-manager-database';
import { ResourceUsageEventDto } from '../dtos/resource-usage-event.dto';
import { ResourceUsageMappingService } from './resource-usage-mapping.service';

@Injectable()
export class ResourceUsageService {
  private readonly logger = new Logger(ResourceUsageService.name);

  constructor(
    @InjectRepository(ResourceUsageEvent)
    private readonly resourceUsageRepository: Repository<ResourceUsageEvent>,
    private readonly mappingService: ResourceUsageMappingService,
  ) {}

  async createEvents(
    events: ResourceUsageEventDto[],
  ): Promise<ResourceUsageEvent[]> {
    this.logger.log(`Received ${events.length} resource usage events`);

    const entities = events.map((eventDto) => {
      const entity = new ResourceUsageEvent();
      entity.schema_version = eventDto.schema_version;
      entity.source = eventDto.source;
      entity.time_window_start = new Date(eventDto.time_window_start);
      entity.time_window_end = new Date(eventDto.time_window_end);
      entity.collected_at = new Date(eventDto.collected_at);
      entity.metrics = eventDto.metrics;
      entity.identities = eventDto.identities ?? [];
      entity.context = eventDto.context;
      entity.extra = eventDto.extra || null;
      return entity;
    });

    const savedEvents = await this.resourceUsageRepository.save(entities);
    this.logger.log(
      `Successfully saved ${savedEvents.length} resource usage events`,
    );

    await this.mappingService.synchronizeAssociations(savedEvents);

    return savedEvents;
  }
}
