import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
	Project,
	ProjectStatus,
	ResourceUsageEvent,
	User
} from 'resource-manager-database';

interface IdentityCandidate {
	externalId?: string;
	email?: string;
	username?: string;
	name?: string;
}

@Injectable()
export class ResourceUsageUserFakerService {
	private readonly logger = new Logger(ResourceUsageUserFakerService.name);

	constructor(private readonly dataSource: DataSource) {}

	public async syncFromResourceUsage(): Promise<void> {
		const eventRepository = this.dataSource.getRepository(ResourceUsageEvent);
		const userRepository = this.dataSource.getRepository(User);
		const projectRepository = this.dataSource.getRepository(Project);

		const events = await eventRepository.find();
		if (events.length === 0) {
			this.logger.log('No resource usage events found, nothing to fake.');
			return;
		}

		const candidates = new Map<string, IdentityCandidate>();

		for (const event of events) {
			const candidate = this.buildCandidate(event);
			if (!candidate) {
				continue;
			}

			const key = candidate.externalId ?? candidate.email ?? candidate.username;
			if (!key) {
				continue;
			}

			const existing = candidates.get(key) ?? {};
			candidates.set(key, {
				externalId: candidate.externalId ?? existing.externalId,
				email: candidate.email ?? existing.email,
				username: candidate.username ?? existing.username,
				name: candidate.name ?? existing.name
			});
		}

		let createdUsers = 0;
		let updatedUsers = 0;

		for (const candidate of candidates.values()) {
			const user = await this.findExistingUser(userRepository, candidate);
			if (user) {
				const changed = this.mergeUserFields(user, candidate);
				if (changed) {
					await userRepository.save(user);
					updatedUsers += 1;
				}
				await this.ensureDefaultProject(projectRepository, user);
				continue;
			}

			const newUser = userRepository.create({
				source: 'perun',
				externalId: candidate.externalId ?? null,
				email: candidate.email ?? this.buildFallbackEmail(candidate),
				emailVerified: true,
				username: candidate.username ?? null,
				name: candidate.name ?? null,
				roleId: 1
			});
			const saved = await userRepository.save(newUser);
			createdUsers += 1;
			await this.ensureDefaultProject(projectRepository, saved);
		}

		this.logger.log(
			`Resource usage faker finished. created=${createdUsers}, updated=${updatedUsers}, processed=${candidates.size}`
		);
	}

	private buildCandidate(event: ResourceUsageEvent): IdentityCandidate | null {
		const identities = Array.isArray(event.identities) ? event.identities : [];
		if (!identities.length) {
			return null;
		}

		const getIdentity = (scheme: string) =>
			identities.find((identity) => identity?.scheme === scheme && identity?.value);

		const oidc = getIdentity('oidc_sub');
		const emailIdentity = getIdentity('user_email');
		const usernameIdentity = getIdentity('perun_username');

		if (!oidc && !emailIdentity && !usernameIdentity) {
			return null;
		}

		const contextName = this.extractNameFromContext(event);

		return {
			externalId: oidc?.value?.trim(),
			email: emailIdentity?.value?.trim().toLowerCase(),
			username: usernameIdentity?.value?.trim(),
			name: contextName
		};
	}

	private extractNameFromContext(event: ResourceUsageEvent): string | undefined {
		const context = (event.context ?? {}) as Record<string, unknown>;
		const nameCandidate = context['user'] ?? context['username'] ?? context['owner'];
		if (!nameCandidate) {
			return undefined;
		}
		const normalized = String(nameCandidate).trim();
		return normalized.length ? normalized : undefined;
	}

	private async findExistingUser(
		repository: Repository<User>,
		candidate: IdentityCandidate
	): Promise<User | null> {
		if (candidate.externalId) {
			const byExternal = await repository.findOne({ where: { externalId: candidate.externalId } });
			if (byExternal) {
				return byExternal;
			}
		}

		if (candidate.email) {
			const byEmail = await repository.findOne({ where: { email: candidate.email } });
			if (byEmail) {
				return byEmail;
			}
		}

		if (candidate.username) {
			const byUsername = await repository.findOne({ where: { username: candidate.username } });
			if (byUsername) {
				return byUsername;
			}
		}

		return null;
	}

	private mergeUserFields(user: User, candidate: IdentityCandidate): boolean {
		let changed = false;
		if (!user.externalId && candidate.externalId) {
			user.externalId = candidate.externalId;
			changed = true;
		}
		if (!user.username && candidate.username) {
			user.username = candidate.username;
			changed = true;
		}
		if (!user.name && candidate.name) {
			user.name = candidate.name;
			changed = true;
		}
		if (!user.email && candidate.email) {
			user.email = candidate.email;
			changed = true;
		}
		return changed;
	}

	private buildFallbackEmail(candidate: IdentityCandidate): string {
		const seed = candidate.username ?? candidate.externalId ?? `usage-${Date.now()}`;
		const normalized = seed.toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'resource-user';
		return `${normalized}@usage.fake`; // clearly fake domain so it is easy to filter out
	}

	private async ensureDefaultProject(projectRepository: Repository<Project>, user: User) {
		const existing = await projectRepository.findOne({ where: { piId: user.id, isDefault: true } });
		if (existing) {
			return;
		}

		const project = projectRepository.create({
			title: this.buildDefaultProjectTitle(user),
			description: this.buildDefaultProjectDescription(user),
			status: ProjectStatus.ACTIVE,
			piId: user.id,
			isDefault: true
		});

		await projectRepository.save(project);
	}

	private buildDefaultProjectTitle(user: User): string {
		const email = user.email ?? `user-${user.id}`;
		const source = user.source ?? 'unknown';
		return `Default project ${email}:${source}`;
	}

	private buildDefaultProjectDescription(user: User): string {
		const identifier = user.name ?? user.email ?? user.username ?? `ID ${user.id}`;
		return `Default project created automatically for ${identifier}.`;
	}
}
