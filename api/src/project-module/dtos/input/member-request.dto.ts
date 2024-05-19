export class MemberRequestDto {
	/**
	 * External ID in Perun.
	 */
	id: number;
	/**
	 * User role.
	 */
	role: string;
}

export class MemberRequestListDto {
	members: MemberRequestDto[];
}
