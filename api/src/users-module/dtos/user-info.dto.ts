// TODO will match response from Perun
export class UserInfoDto {
	/**
	 * User ID.
	 */
	id: number;
	/**
	 * User email.
	 */
	email: string;
	/**
	 * User name.
	 */
	name: string;
	/**
	 * User username.
	 */
	username: string;
}

export class UserInfoListDto {
	users: UserInfoDto[];
}
