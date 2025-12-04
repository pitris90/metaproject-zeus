import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceUsageEvent } from 'resource-manager-database';
import { ResourceUsageEventDto } from '../dtos/resource-usage-event.dto';
import { OpenstackTagsCatalogService } from '../../openstack-module/services/openstack-tags.service';
import { ResourceUsageAggregationService } from './resource-usage-aggregation.service';
import { ResourceUsageProjectMapperService } from './resource-usage-project-mapper.service';

@Injectable()
export class ResourceUsageService {
	private readonly logger = new Logger(ResourceUsageService.name);

	constructor(
		@InjectRepository(ResourceUsageEvent)
		private readonly resourceUsageRepository: Repository<ResourceUsageEvent>,
		private readonly projectMapper: ResourceUsageProjectMapperService,
		private readonly aggregationService: ResourceUsageAggregationService,
		private readonly openstackTagsCatalog: OpenstackTagsCatalogService
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

				// Extract and populate projectSlug from DTO or context
				// Priority: top-level project_slug > context.project > context.project_slug
				const context = (eventDto.context ?? {}) as Record<string, unknown>;
				const projectValue =
					eventDto.project_slug ?? context['project'] ?? context['project_slug'] ?? context['projectTitle'];
				if (projectValue) {
					const normalized = String(projectValue).trim();
					entity.projectSlug = normalized.length ? normalized : null;
				} else {
					entity.projectSlug = null;
				}

				// Extract is_personal from top level (new format) or context (legacy format)
				const isPersonal =
					eventDto.is_personal ?? (context['is_personal'] === true || context['is_personal'] === 'true');
				entity.isPersonal = isPersonal;

				// Map project_id using the consolidated mapper
				entity.projectId = await this.projectMapper.mapEventToProject(
					entity.projectSlug,
					entity.source,
					entity.isPersonal,
					entity.identities
				);

				// Populate allocation_identifier for filtering/grouping
				// PBS: context.jobname (each job is an allocation)
				// OpenStack: stripped project slug (the project allocation)
				if (entity.source === 'pbs') {
					const jobname = context['jobname'];
					entity.allocationIdentifier = jobname ? String(jobname) : null;
				} else if (entity.source === 'openstack' && entity.projectSlug) {
					// Strip customer prefix for OpenStack (e.g., "metacentrum-myproject" → "myproject")
					entity.allocationIdentifier = this.removeCustomerPrefix(entity.projectSlug);
				} else {
					entity.allocationIdentifier = null;
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

	/**
	 * Remove known customer prefix from OpenStack project slug.
	 * Tests each known customer key from the catalog (e.g., "cerit-sc", "metacentrum").
	 * Only strips if the slug starts with a known customer key followed by a dash.
	 */
	private removeCustomerPrefix(openstackProjectSlug: string): string {
		const customers = this.openstackTagsCatalog.getCatalog().customers;

		for (const customer of customers) {
			const prefix = `${customer.key}-`;
			if (openstackProjectSlug.startsWith(prefix)) {
				return openstackProjectSlug.substring(prefix.length);
			}
		}

		// No known customer prefix found - return as-is
		return openstackProjectSlug;
	}
}
