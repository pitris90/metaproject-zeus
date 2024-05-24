export class MemberRequestDto {
	/**
	 * External ID in Perun.
	 */
	id: number;
	/**
	 * User role.
	 */
	role: 'user' | 'manager';
}

export class MemberRequestListDto {
	members: MemberRequestDto[];
}
