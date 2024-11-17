export class PerunApiException extends Error {
	private readonly perunName?: string;
	private readonly perunMessage?: string;

	constructor(name?: string, message?: string) {
		super('Perun API Exception');

		this.perunName = name;
		this.perunMessage = message;
	}

	getName(): string | undefined {
		return this.perunName;
	}

	getMessage(): string | undefined {
		return this.perunMessage;
	}
}
