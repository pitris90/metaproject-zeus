export class MemberRequestDto {
	/**
	 * External ID in Perun.
	 */
	id: string;
	/**
	 * User role.
	 */
	role: 'user' | 'manager';
}

export class MemberRequestListDto {
	members: MemberRequestDto[];
}
