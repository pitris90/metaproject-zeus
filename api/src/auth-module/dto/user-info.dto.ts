export class UserInfoDto {
	sub: string;
	name: string;
	given_name?: string;
	family_name?: string;
	locale?: string;
	email: string;
	email_verified: boolean;
	preferred_username: string;
	eduperson_entitlement?: string[];
}
