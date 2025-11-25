import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageEvent } from 'resource-manager-database';
import { ResourceUsageEventDto } from '../dtos/resource-usage-event.dto';
import { ResourceUsageAggregationService } from './resource-usage-aggregation.service';
import { ResourceUsageProjectMapperService } from './resource-usage-project-mapper.service';

@Injectable()
export class ResourceUsageService {
	private readonly logger = new Logger(ResourceUsageService.name);

	constructor(
		@InjectRepository(ResourceUsageEvent)
		private readonly resourceUsageRepository: Repository<ResourceUsageEvent>,
		private readonly projectMapper: ResourceUsageProjectMapperService,
		private readonly aggregationService: ResourceUsageAggregationService
	) {}

	async createEvents(events: ResourceUsageEventDto[], isLastBatch: boolean = false): Promise<ResourceUsageEvent[]> {
		this.logger.log(`Received ${events.length} resource usage events (last_batch: ${isLastBatch})`);

		const entities = await Promise.all(
			events.map(async (eventDto) => {
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

				// Extract and populate projectName from context
				const context = (eventDto.context ?? {}) as Record<string, unknown>;
				const projectValue = context['project'] ?? context['project_name'] ?? context['projectTitle'];
				if (projectValue) {
					const normalized = String(projectValue).trim();
					entity.projectName = normalized.length ? normalized : null;
				} else {
					entity.projectName = null;
				}

				// Extract is_personal from top level (new format) or context (legacy format)
				const isPersonal =
					eventDto.is_personal ?? (context['is_personal'] === true || context['is_personal'] === 'true');
				entity.isPersonal = isPersonal;

				// Map project_id
				if (isPersonal) {
					// Personal project - map via user identity
					entity.projectId = await this.projectMapper.mapPersonalProject(entity.identities);
				} else if (entity.projectName) {
					// Regular project - map via project name
					entity.projectId = await this.projectMapper.mapRegularProject(entity.projectName, entity.source);
				} else {
					entity.projectId = null;
				}

				return entity;
			})
		);

		const savedEvents = await this.resourceUsageRepository.save(entities);
		this.logger.log(`Successfully saved ${savedEvents.length} resource usage events`);

		// Only trigger aggregation if this is the last batch
		if (isLastBatch) {
			// Automatically aggregate only the dates from the new events
			const uniqueDates = [
				...new Set(
					savedEvents.map((e) => {
						const date = new Date(e.time_window_start);
						date.setHours(0, 0, 0, 0);
						return date.getTime();
					})
				)
			].map((timestamp) => new Date(timestamp));

			if (uniqueDates.length > 0) {
				this.logger.log(`Triggering aggregation for ${uniqueDates.length} dates (last batch received)`);
				// Run aggregation asynchronously without blocking the response
				this.aggregationService.aggregateForDates(uniqueDates).catch((err) => {
					this.logger.error('Failed to trigger automatic aggregation', err);
				});
			}
		} else {
			this.logger.log('Skipping aggregation - waiting for last batch');
		}

		return savedEvents;
	}
}
