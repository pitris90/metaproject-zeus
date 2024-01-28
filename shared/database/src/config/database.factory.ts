import { Database } from './database.config';

export class DatabaseFactory {
	create(): Database {
		const host = process.env['POSTGRES_HOST'];
		const port = +process.env['POSTGRES_PORT'];
		const username = process.env['POSTGRES_USER'];
		const password = process.env['POSTGRES_PASSWORD'];
		const database = process.env['POSTGRES_DATABASE'];

		if (!host || !port || !username || !database || !password) {
			throw new Error(`Invalid database configuration: postgresql://${username}@${host}:${port}/${database}`);
		}

		return new Database(host, port, username, password, database);
	}
}