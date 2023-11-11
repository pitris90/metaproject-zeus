
export class Database {
	constructor(
		private _host: string,
		private _port: number,
		private _username: string,
		private _password: string,
		private _database: string
	) {
	}

	get host(): string {
		return this._host;
	}

	get port(): number {
		return this._port;
	}

	get username(): string {
		return this._username;
	}

	get password(): string {
		return this._password;
	}

	get database(): string {
		return this._database;
	}
}