import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Role, User } from 'resource-manager-database';

type RoleCode = 'admin' | 'director' | 'user';

interface EnsureMockUserOptions {
	id?: number;
	externalId?: string;
	email?: string;
	roleCode?: RoleCode;
	name?: string;
	username?: string;
	locale?: string;
}

@Injectable()
export class UsersModel {
	constructor(private readonly dataSource: DataSource) {}

	async findUserById(id: number): Promise<User | null> {
		return this.dataSource.getRepository(User).findOne({
			relations: {
				role: true
			},
			where: {
				id
			}
		});
	}

	async findUserByExternalId(externalId: string): Promise<User | null> {
		return this.dataSource.getRepository(User).findOne({
			relations: {
				role: true
			},
			where: {
				externalId
			}
		});
	}

	async getUserRole(id: number): Promise<Role | null> {
		const user = await this.dataSource.getRepository(User).findOne({
			where: {
				id
			},
			relations: ['role']
		});

		if (!user) {
			return null;
		}

		return user.role;
	}

	private async ensureRole(roleCode: RoleCode): Promise<Role> {
		const roleRepo = this.dataSource.getRepository(Role);
		let role = await roleRepo.findOne({ where: { codeName: roleCode } });
		if (!role) {
			role = await roleRepo.save({
				codeName: roleCode,
				name: roleCode.charAt(0).toUpperCase() + roleCode.slice(1)
			});
		}
		return role;
	}

	private resolveMockDefaults(options: EnsureMockUserOptions): Required<Omit<EnsureMockUserOptions, 'id' | 'roleCode'>> {
		const { id, externalId, email, name, username, locale } = options;
		const baseExternalId =
			externalId ??
			(typeof id === 'number' && Number.isFinite(id)
				? `mock-user-${id}`
				: 'bypass-external-id');
		const resolvedEmail =
			email ??
			(baseExternalId === 'bypass-external-id'
				? 'mock.user@example.com'
				: `${baseExternalId}@example.com`);
		return {
			externalId: baseExternalId,
			email: resolvedEmail,
			name:
				name ??
				(baseExternalId === 'bypass-external-id'
					? 'Mock User'
					: typeof id === 'number' && Number.isFinite(id)
						? `Mock User ${id}`
						: `Mock ${baseExternalId}`),
			username: username ?? (baseExternalId === 'bypass-external-id' ? 'mockuser' : baseExternalId),
			locale: locale ?? 'en'
		};
	}

	async ensureMockUser(options: EnsureMockUserOptions = {}): Promise<User> {
		const roleCode = options.roleCode ?? 'admin';
		const role = await this.ensureRole(roleCode);
		const userRepo = this.dataSource.getRepository(User);
		const relations = { relations: { role: true } } as const;

		let user: User | null = null;
		if (typeof options.id === 'number' && Number.isInteger(options.id)) {
			user = await userRepo.findOne({ where: { id: options.id }, ...relations });
		}
		if (!user && options.externalId) {
			user = await userRepo.findOne({ where: { externalId: options.externalId }, ...relations });
		}
		if (!user && options.email) {
			user = await userRepo.findOne({ where: { email: options.email }, ...relations });
		}

		const defaults = this.resolveMockDefaults(options);
		const resolvedExternalId = options.externalId ?? user?.externalId ?? defaults.externalId;
		const resolvedEmail = options.email ?? user?.email ?? defaults.email;
		const resolvedName = options.name ?? user?.name ?? defaults.name;
		const resolvedUsername = options.username ?? user?.username ?? defaults.username;
		const resolvedLocale = options.locale ?? user?.locale ?? defaults.locale;

		if (!user) {
			const entity = userRepo.create({
				id: options.id,
				source: 'perun',
				externalId: resolvedExternalId,
				email: resolvedEmail,
				emailVerified: true,
				username: resolvedUsername,
				name: resolvedName,
				locale: resolvedLocale,
				roleId: role.id
			});
			const saved = await userRepo.save(entity);
			user = await userRepo.findOne({ where: { id: saved.id }, ...relations });
			return user!;
		}

		const updates: Partial<User> = {};
		if (user.roleId !== role.id) {
			updates.roleId = role.id;
		}
		if (options.externalId !== undefined && user.externalId !== resolvedExternalId) {
			updates.externalId = resolvedExternalId;
		} else if (!user.externalId && resolvedExternalId) {
			updates.externalId = resolvedExternalId;
		}
		if (options.email !== undefined && user.email !== resolvedEmail) {
			updates.email = resolvedEmail;
		} else if (!user.email && resolvedEmail) {
			updates.email = resolvedEmail;
		}
		if (options.username !== undefined && user.username !== resolvedUsername) {
			updates.username = resolvedUsername;
		} else if (!user.username && resolvedUsername) {
			updates.username = resolvedUsername;
		}
		if (options.name !== undefined && user.name !== resolvedName) {
			updates.name = resolvedName;
		} else if (!user.name && resolvedName) {
			updates.name = resolvedName;
		}
		if (options.locale !== undefined && user.locale !== resolvedLocale) {
			updates.locale = resolvedLocale;
		} else if (!user.locale && resolvedLocale) {
			updates.locale = resolvedLocale;
		}

		if (Object.keys(updates).length) {
			await userRepo.update({ id: user.id }, updates);
			user = await userRepo.findOne({ where: { id: user.id }, ...relations });
		}

		return user!;
	}

	/**
	 * Ensures a persisted bypass user exists and returns it with role relation.
	 * Will create the role if it does not exist.
	 */
	async ensureBypassUser(roleCode: RoleCode = 'admin'): Promise<User> {
		return this.ensureMockUser({
			roleCode,
			externalId: 'bypass-external-id',
			email: 'mock.user@example.com',
			username: 'mockuser',
			name: 'Mock User',
			locale: 'en'
		});
	}

	/**
	 * Create or retrieve a dev user with provided identifiers. Useful for switching between
	 * multiple test users in AUTH_BYPASS mode.
	 */
	async ensureDevUser(options: EnsureMockUserOptions): Promise<User> {
		const roleCode = options.roleCode ?? 'user';
		const baseExternalId =
			options.externalId ??
			(options.email ? options.email.split('@')[0] : `dev-${Math.random().toString(36).slice(2, 8)}`);
		return this.ensureMockUser({
			...options,
			roleCode,
			externalId: options.externalId ?? baseExternalId,
			email: options.email ?? `${baseExternalId}@example.com`,
			username: options.username ?? baseExternalId,
			name: options.name ?? `Dev ${baseExternalId}`,
			locale: options.locale ?? 'en'
		});
	}
}
