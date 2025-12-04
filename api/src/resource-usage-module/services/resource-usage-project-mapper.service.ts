import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Project, User } from 'resource-manager-database';
import { OpenstackTagsCatalogService } from '../../openstack-module/services/openstack-tags.service';

interface Identity {
	scheme: string;
	value: string;
	authority?: string;
}

@Injectable()
export class ResourceUsageProjectMapperService {
	private readonly logger = new Logger(ResourceUsageProjectMapperService.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Project)
		private readonly projectRepository: Repository<Project>,
		private readonly openstackTagsCatalog: OpenstackTagsCatalogService
	) {}

	/**
	 * Main entry point for mapping resource usage events to projects.
	 * Called during event ingestion to resolve project_id.
	 *
	 * @param projectSlug - The project slug from the event (e.g., "metacentrum-my-project" or "my-project")
	 * @param source - Data source: "pbs" or "openstack"
	 * @param isPersonal - Whether this is a personal project
	 * @param identities - List of identities for user resolution (used for personal projects)
	 */
	async mapEventToProject(
		projectSlug: string | null,
		source: string,
		isPersonal: boolean,
		identities: Identity[]
	): Promise<number | null> {
		if (isPersonal) {
			return this.mapPersonalProject(identities);
		}
		if (projectSlug) {
			return this.mapRegularProject(projectSlug, source);
		}
		return null;
	}

	/**
	 * Resolve user ID from a single identity.
	 * Matches identity scheme to user fields:
	 * - oidc_sub → user.externalId
	 * - perun_username → user.username
	 * - user_email → user.email
	 */
	private async resolveUserFromIdentity(identity: Identity): Promise<number | null> {
		if (!identity || !identity.scheme || !identity.value) {
			return null;
		}

		const { scheme, value } = identity;
		let user: User | null = null;

		switch (scheme) {
			case 'oidc_sub':
				user = await this.userRepository.findOne({
					where: { externalId: value }
				});
				break;
			case 'perun_username':
				user = await this.userRepository.findOne({
					where: { username: value }
				});
				break;
			case 'user_email':
				user = await this.userRepository.findOne({
					where: { email: value }
				});
				break;
			default:
				return null;
		}

		return user?.id ?? null;
	}

	/**
	 * Map personal project via user identity.
	 * Extracts user from first identity, then finds their personal project.
	 */
	private async mapPersonalProject(identities: Identity[]): Promise<number | null> {
		if (!identities || identities.length === 0) {
			return null;
		}

		// Use first identity for personal projects
		const userId = await this.resolveUserFromIdentity(identities[0]);
		if (!userId) {
			return null;
		}

		// Find user's personal project
		const personalProject = await this.projectRepository.findOne({
			where: {
				piId: userId,
				isPersonal: true
			}
		});

		return personalProject?.id ?? null;
	}

	/**
	 * Map regular (group) project via project slug.
	 * For OpenStack: removes known customer prefix before matching.
	 * For PBS: matches directly against projectSlug.
	 */
	private async mapRegularProject(projectSlug: string, source: string): Promise<number | null> {
		if (!projectSlug) {
			return null;
		}

		// For OpenStack group projects, remove customer prefix
		let cleanedSlug = projectSlug;
		if (source === 'openstack') {
			cleanedSlug = this.removeCustomerPrefix(projectSlug);
		}

		// Find project by slug
		const project = await this.projectRepository.findOne({
			where: { projectSlug: cleanedSlug }
		});

		return project?.id ?? null;
	}

	/**
	 * Remove known customer prefix from OpenStack project slug.
	 * Tests each known customer key from the catalog (e.g., "cerit-sc", "metacentrum").
	 * Only strips if the slug starts with a known customer key followed by a dash.
	 *
	 * Examples:
	 *   "metacentrum-my-project" → "my-project"
	 *   "cerit-sc-my-project" → "my-project"
	 *   "unknown-prefix-project" → "unknown-prefix-project" (no stripping)
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

	/**
	 * Get all known customer keys from the OpenStack catalog.
	 * Used for generating all possible prefixed slugs during backfill.
	 */
	private getKnownCustomerKeys(): string[] {
		return this.openstackTagsCatalog.getCatalog().customers.map((c) => c.key);
	}

	/**
	 * Backfill project_id for existing events and summaries when a project is approved.
	 * This maps historical resource usage records to the newly approved project.
	 */
	async backfillProjectMapping(project: Project): Promise<void> {
		this.logger.log(
			`Starting backfill for project ${project.id} (slug: ${project.projectSlug}, personal: ${project.isPersonal})`
		);

		if (project.isPersonal) {
			await this.backfillPersonalProject(project);
		} else {
			await this.backfillRegularProject(project);
		}

		this.logger.log(`Completed backfill for project ${project.id}`);
	}

	/**
	 * Backfill personal project mapping.
	 * Updates events and summaries where identities match the project owner.
	 */
	private async backfillPersonalProject(project: Project): Promise<void> {
		const user = await this.userRepository.findOne({
			where: { id: project.piId }
		});

		if (!user) {
			this.logger.warn(`User ${project.piId} not found for personal project ${project.id}`);
			return;
		}

		const identityConditions: string[] = [];
		const queryParams: any[] = [project.id]; // Start with project.id as $1

		if (user.externalId) {
			const paramIndex = queryParams.length + 1;
			identityConditions.push(
				`EXISTS (SELECT 1 FROM jsonb_array_elements(identities) AS identity 
				 WHERE identity->>'scheme' = 'oidc_sub' AND identity->>'value' = $${paramIndex})`
			);
			queryParams.push(user.externalId);
		}

		if (user.username) {
			const paramIndex = queryParams.length + 1;
			identityConditions.push(
				`EXISTS (SELECT 1 FROM jsonb_array_elements(identities) AS identity 
				 WHERE identity->>'scheme' = 'perun_username' AND identity->>'value' = $${paramIndex})`
			);
			queryParams.push(user.username);
		}

		if (user.email) {
			const paramIndex = queryParams.length + 1;
			identityConditions.push(
				`EXISTS (SELECT 1 FROM jsonb_array_elements(identities) AS identity 
				 WHERE identity->>'scheme' = 'user_email' AND identity->>'value' = $${paramIndex})`
			);
			queryParams.push(user.email);
		}

		if (identityConditions.length === 0) {
			this.logger.warn(`No identity fields available for user ${user.id}`);
			return;
		}

		const identityWhereClause = `(${identityConditions.join(' OR ')})`;

		// Update events
		const eventsResult = await this.projectRepository.manager.query(
			`UPDATE resource_usage_events 
			 SET project_id = $1 
			 WHERE is_personal = true AND project_id IS NULL AND ${identityWhereClause}`,
			queryParams
		);
		this.logger.debug(`Updated ${eventsResult[1] ?? 0} events for personal project ${project.id}`);

		// Update summaries
		const summariesResult = await this.projectRepository.manager.query(
			`UPDATE resource_usage_summaries 
			 SET project_id = $1 
			 WHERE is_personal = true AND project_id IS NULL AND ${identityWhereClause}`,
			queryParams
		);
		this.logger.debug(`Updated ${summariesResult[1] ?? 0} summaries for personal project ${project.id}`);
	}

	/**
	 * Backfill regular (group) project mapping.
	 * Updates events and summaries where project_slug matches.
	 *
	 * For PBS: matches exact project_slug
	 * For OpenStack: matches any known customer-prefixed slug (e.g., "metacentrum-my-project")
	 */
	private async backfillRegularProject(project: Project): Promise<void> {
		const baseSlug = project.projectSlug;
		const customerKeys = this.getKnownCustomerKeys();

		// Generate all possible prefixed slugs for OpenStack matching
		const prefixedSlugs = customerKeys.map((key) => `${key}-${baseSlug}`);

		// All slugs that should map to this project (base + all prefixed versions)
		const allPossibleSlugs = [baseSlug, ...prefixedSlugs];

		// Update events - PBS matches base slug, OpenStack matches any prefixed version
		const eventsResult = await this.projectRepository.manager.query(
			`UPDATE resource_usage_events 
			 SET project_id = $1 
			 WHERE project_id IS NULL 
			 AND is_personal = false
			 AND (
			   (source = 'pbs' AND project_slug = $2)
			   OR 
			   (source = 'openstack' AND project_slug = ANY($3))
			 )`,
			[project.id, baseSlug, allPossibleSlugs]
		);
		this.logger.debug(`Updated ${eventsResult[1] ?? 0} events for project ${project.id}`);

		// Update summaries
		const summariesResult = await this.projectRepository.manager.query(
			`UPDATE resource_usage_summaries 
			 SET project_id = $1 
			 WHERE project_id IS NULL 
			 AND is_personal = false
			 AND (
			   (source = 'pbs' AND project_slug = $2)
			   OR 
			   (source = 'openstack' AND project_slug = ANY($3))
			 )`,
			[project.id, baseSlug, allPossibleSlugs]
		);
		this.logger.debug(`Updated ${summariesResult[1] ?? 0} summaries for project ${project.id}`);
	}

	/**
	 * Unmap all resource usage records for a project.
	 * Sets project_id to NULL for all events and summaries.
	 * This is used when a project's title/slug changes.
	 *
	 * @param manager - EntityManager to use (for transaction support)
	 * @param projectId - The project ID to unmap
	 */
	async unmapProjectUsage(manager: EntityManager, projectId: number): Promise<void> {
		// Unmap events
		await manager.query(
			`UPDATE resource_usage_events 
			 SET project_id = NULL 
			 WHERE project_id = $1`,
			[projectId]
		);

		// Unmap summaries
		await manager.query(
			`UPDATE resource_usage_summaries 
			 SET project_id = NULL 
			 WHERE project_id = $1`,
			[projectId]
		);
	}
}
