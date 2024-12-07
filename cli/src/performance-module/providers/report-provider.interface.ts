import { User } from 'resource-manager-database';
import { DataSource } from 'typeorm';

export abstract class ReportProvider {
	protected savedUser: User | undefined;

	protected constructor(protected dataSource: DataSource) {}

	abstract getTemplate(): string;

	abstract getEndpoint(): Promise<string>;

	abstract getBody(): Record<string, string>;

	abstract getMethod(): string;

	async getHeaders(): Promise<Record<string, string>> {
		if (this.savedUser === undefined) {
			this.savedUser = await this.getRandomUser();
		}

		return {
			Authorization: `Bearer ${this.savedUser.externalId}`
		};
	}

	async getRandomUser(): Promise<User> {
		if (this.savedUser !== undefined) {
			return this.savedUser;
		}

		return this.dataSource
			.getRepository(User)
			.createQueryBuilder('user')
			.select()
			.orderBy('RANDOM()')
			.getOneOrFail();
	}

	reset(): void {
		this.savedUser = undefined;
	}
}
