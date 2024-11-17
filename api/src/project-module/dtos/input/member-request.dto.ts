export class MemberRequestDto {
	/**
	 * Email for invitation.
	 */
	email: string;
	/**
	 * User role.
	 */
	role: 'user' | 'manager';
}

export class MemberRequestListDto {
	members: MemberRequestDto[];
}
