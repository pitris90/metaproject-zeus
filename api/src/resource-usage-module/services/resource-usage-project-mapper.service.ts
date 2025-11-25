import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Project, User } from 'resource-manager-database';

interface Identity {
	scheme: string;
	value: string;
	authority?: string;
}

@Injectable()
export class ResourceUsageProjectMapperService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Project)
		private readonly projectRepository: Repository<Project>
	) {}

	/**
	 * Resolve user ID from a single identity
	 * Matches identity scheme to user fields:
	 * - oidc_sub → user.externalId
	 * - perun_username → user.username
	 * - user_email → user.email
	 */
	async resolveUserFromIdentity(identity: Identity): Promise<number | null> {
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
	 * Map project_name to project_id for personal projects
	 * Extracts user from first identity, then finds their personal project
	 */
	async mapPersonalProject(identities: Identity[]): Promise<number | null> {
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
	 * Map project_name to project_id for regular projects
	 * For OpenStack: removes customer prefix before matching
	 */
	async mapRegularProject(projectName: string, source: string): Promise<number | null> {
		if (!projectName) {
			return null;
		}

		// For OpenStack, remove customer prefix
		let cleanedProjectName = projectName;
		if (source === 'openstack') {
			cleanedProjectName = this.removeCustomerPrefix(projectName);
		}

		// Find project by slug
		const project = await this.projectRepository.findOne({
			where: { projectSlug: cleanedProjectName }
		});

		return project?.id ?? null;
	}

	/**
	 * Remove customer prefix from OpenStack project name
	 * Pattern: "<customer_key>-<project_name>" → "<project_name>"
	 */
	private removeCustomerPrefix(openstackProjectName: string): string {
		const firstDashIndex = openstackProjectName.indexOf('-');
		if (firstDashIndex === -1) {
			return openstackProjectName;
		}
		return openstackProjectName.substring(firstDashIndex + 1);
	}

	/**
	 * Backfill project_id for existing events and summaries when a project is created
	 */
	async backfillProjectMapping(project: Project): Promise<void> {
		if (project.isPersonal) {
			await this.backfillPersonalProject(project);
		} else {
			await this.backfillRegularProject(project);
		}
	}

	/**
	 * Backfill personal project mapping
	 * Updates events and summaries where identities match the project owner
	 */
	private async backfillPersonalProject(project: Project): Promise<void> {
		const user = await this.userRepository.findOne({
			where: { id: project.piId }
		});

		if (!user) {
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
			return;
		}

		const whereClause = `is_personal = true AND project_id IS NULL AND (${identityConditions.join(' OR ')})`;

		// Update events
		await this.projectRepository.manager.query(
			`UPDATE resource_usage_events 
			 SET project_id = $1 
			 WHERE ${whereClause}`,
			queryParams
		);

		// Update summaries
		await this.projectRepository.manager.query(
			`UPDATE resource_usage_daily_summaries 
			 SET project_id = $1 
			 WHERE project_id IS NULL AND (${identityConditions.join(' OR ')})`,
			queryParams
		);
	}

	/**
	 * Backfill regular project mapping
	 * Updates events and summaries where project_name matches projectSlug
	 */
	private async backfillRegularProject(project: Project): Promise<void> {
		// For OpenStack projects, we need to check both with and without customer prefix
		// Since we don't know the customer key, we'll match any project_name ending with "-{projectSlug}"

		// Update events - direct match
		await this.projectRepository.manager.query(
			`UPDATE resource_usage_events 
			 SET project_id = $1 
			 WHERE project_id IS NULL 
			 AND (
			   project_name = $2 
			   OR (source = 'openstack' AND project_name LIKE '%' || '-' || $2)
			 )`,
			[project.id, project.projectSlug]
		);

		// Update summaries - direct match
		await this.projectRepository.manager.query(
			`UPDATE resource_usage_daily_summaries 
			 SET project_id = $1 
			 WHERE project_id IS NULL 
			 AND (
			   project_name = $2 
			   OR (source = 'openstack' AND project_name LIKE '%' || '-' || $2)
			 )`,
			[project.id, project.projectSlug]
		);
	}

	/**
	 * Unmap all resource usage records for a project
	 * Sets project_id to NULL for all events and summaries
	 * This is used when a project's title/slug changes
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
			`UPDATE resource_usage_daily_summaries 
			 SET project_id = NULL 
			 WHERE project_id = $1`,
			[projectId]
		);
	}
}
