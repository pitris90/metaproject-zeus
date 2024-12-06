export interface ReportProvider {
	getEndpoint(): string;

	getBody(): Record<string, string>;

	getMethod(): string;

	getHeaders(): Promise<Record<string, string>>;
}
