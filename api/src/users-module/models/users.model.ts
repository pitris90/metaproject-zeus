import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Role, User } from 'resource-manager-database';

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

	/**
	 * Ensures a persisted bypass user exists and returns it with role relation.
	 * Will create the role if it does not exist.
	 */
	async ensureBypassUser(roleCode: 'admin' | 'director' | 'user' = 'admin'): Promise<User> {
		const roleRepo = this.dataSource.getRepository(Role);
		let role = await roleRepo.findOne({ where: { codeName: roleCode } });
		if (!role) {
			role = await roleRepo.save({
				codeName: roleCode,
				name: roleCode.charAt(0).toUpperCase() + roleCode.slice(1)
			});
		}

		const userRepo = this.dataSource.getRepository(User);
		await userRepo
			.createQueryBuilder()
			.insert()
			.into(User)
			.values({
				source: 'perun',
				externalId: 'bypass-external-id',
				email: 'mock.user@example.com',
				emailVerified: true,
				username: 'mockuser',
				name: 'Mock User',
				locale: 'en',
				roleId: role.id
			})
			.orIgnore()
			.execute();

		const user = await userRepo.findOne({
			where: { externalId: 'bypass-external-id' },
			relations: { role: true }
		});
		// As a safety net if a row existed with different roleId, ensure it has desired role
		if (user && user.roleId !== role.id) {
			await userRepo.update({ id: user.id }, { roleId: role.id });
			return (await userRepo.findOne({ where: { id: user.id }, relations: { role: true } }))!;
		}
		return user!;
	}

	/**
	 * Create or retrieve a dev user with provided identifiers. Useful for switching between
	 * multiple test users in AUTH_BYPASS mode.
	 */
	async ensureDevUser(options: {
		externalId?: string;
		email?: string;
		roleCode?: 'admin' | 'director' | 'user';
		name?: string;
		username?: string;
		locale?: string;
	}): Promise<User> {
		const roleCode = options.roleCode ?? 'user';
		const roleRepo = this.dataSource.getRepository(Role);
		let role = await roleRepo.findOne({ where: { codeName: roleCode } });
		if (!role) {
			role = await roleRepo.save({
				codeName: roleCode,
				name: roleCode.charAt(0).toUpperCase() + roleCode.slice(1)
			});
		}

		const userRepo = this.dataSource.getRepository(User);
		const externalId = options.externalId ?? `dev-${Math.random().toString(36).slice(2, 8)}`;
		const email = options.email ?? `${externalId}@example.com`;
		const username = options.username ?? externalId;
		const name = options.name ?? `Dev ${externalId}`;
		const locale = options.locale ?? 'en';

		// Try find by externalId first, then by email
		let user = await userRepo.findOne({ where: { externalId }, relations: { role: true } });
		if (!user) {
			user = await userRepo.findOne({ where: { email }, relations: { role: true } });
		}

		if (!user) {
			await userRepo
				.createQueryBuilder()
				.insert()
				.into(User)
				.values({
					source: 'perun',
					externalId,
					email,
					emailVerified: true,
					username,
					name,
					locale,
					roleId: role.id
				})
				.orIgnore()
				.execute();

			user = await userRepo.findOne({ where: { externalId }, relations: { role: true } });
		}

		if (!user) {
			// As a last resort, fetch by email
			user = await userRepo.findOne({ where: { email }, relations: { role: true } });
		}

		if (!user) {
			throw new Error('Failed to create or load dev user');
		}

		// Ensure the role and basic fields are up to date
		const updates: Partial<User> = {} as any;
		if (user.roleId !== role.id) updates.roleId = role.id as any;
		if (user.email !== email) updates.email = email as any;
		if (user.username !== username) updates.username = username as any;
		if (user.name !== name) updates.name = name as any;
		if (user.locale !== locale) updates.locale = locale as any;
		if (Object.keys(updates).length) {
			await userRepo.update({ id: user.id }, updates);
			user = (await userRepo.findOne({ where: { id: user.id }, relations: { role: true } }))!;
		}

		return user;
	}
}
