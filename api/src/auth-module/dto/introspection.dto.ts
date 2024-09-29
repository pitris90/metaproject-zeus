export class IntrospectionDto {
	scope: string;
	client_id: string;
	token_type: string;
	exp: number;
	username: string;
	iat: number;
	sub: string;
	aud: string[];
	iss: string;
	jti: string;
	acr: string;
	auth_time: number;
	active: boolean;
}
