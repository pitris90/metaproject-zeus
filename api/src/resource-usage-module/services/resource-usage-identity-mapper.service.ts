import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Project } from 'resource-manager-database';

interface Identity {
	scheme: string;
	value: string;
	authority?: string;
}

@Injectable()
export class ResourceUsageIdentityMapperService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Project)
		private readonly projectRepository: Repository<Project>
	) {}

	/**
	 * Map identity to User based on scheme
	 * - oidc_sub -> user.externalId
	 * - user_email -> user.email
	 * - perun_username -> user.username
	 */
	async mapIdentityToUser(identities: Identity[]): Promise<User | null> {
		if (!identities || identities.length === 0) {
			return null;
		}

		// Try oidc_sub first (most reliable)
		const oidcIdentity = identities.find((id) => id.scheme === 'oidc_sub');
		if (oidcIdentity?.value) {
			const user = await this.userRepository.findOne({
				where: {
					source: 'perun',
					externalId: oidcIdentity.value
				}
			});
			if (user) return user;
		}

		// Try email
		const emailIdentity = identities.find((id) => id.scheme === 'user_email');
		if (emailIdentity?.value) {
			const user = await this.userRepository.findOne({
				where: {
					source: 'perun',
					email: emailIdentity.value
				}
			});
			if (user) return user;
		}

		// Try username
		const usernameIdentity = identities.find((id) => id.scheme === 'perun_username');
		if (usernameIdentity?.value) {
			const user = await this.userRepository.findOne({
				where: {
					source: 'perun',
					username: usernameIdentity.value
				}
			});
			if (user) return user;
		}

		return null;
	}

	/**
	 * Map project name to Project
	 * - PBS: "_pbs_project_default" -> user's personal project
	 * - OpenStack: remove customer prefix, then match by projectSlug
	 * - PBS: match by projectSlug
	 */
	async mapProjectNameToProject(
		projectName: string | null,
		source: string,
		identities: Identity[]
	): Promise<Project | null> {
		if (!projectName) {
			return null;
		}

		// Handle PBS personal project
		if (source === 'pbs' && projectName === '_pbs_project_default') {
			const user = await this.mapIdentityToUser(identities);
			if (user) {
				return this.projectRepository.findOne({
					where: {
						piId: user.id,
						isPersonal: true
					}
				});
			}
			return null;
		}

		// For OpenStack: remove customer prefix (e.g., "metacentrum-my-project" -> "my-project")
		let targetSlug = projectName;
		if (source === 'openstack') {
			targetSlug = this.removeCustomerPrefix(projectName);
		}

		// Find project by projectSlug (already slugified and indexed)
		return this.projectRepository.findOne({
			where: { projectSlug: targetSlug }
		});
	}

	/**
	 * Remove customer prefix from OpenStack project name.
	 * Pattern: "<customer_key>-<project_name>" -> "<project_name>"
	 */
	private removeCustomerPrefix(openstackProjectName: string): string {
		const firstDashIndex = openstackProjectName.indexOf('-');
		if (firstDashIndex === -1) {
			return openstackProjectName;
		}
		return openstackProjectName.substring(firstDashIndex + 1);
	}
}
