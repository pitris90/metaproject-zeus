class AllocationResourceDto {
	/**
	 * Resource name
	 */
	name: string;

	/**
	 * Resource type
	 */
	type: string;
}

class AllocationUserDto {
	/**
	 * User id
	 */
	id: number;

	/**
	 * User name
	 */
	name: string;
}

export class AllocationDto {
	/**
	 * Allocation id
	 */
	id: number;
	/**
	 * Allocation status
	 */
	status: string;
	/**
	 * Allocation end date
	 */
	endDate: Date | null;
	/*
	 * Allocation resource
	 */
	resource: AllocationResourceDto;

	/**
	 * Allocation users
	 */
	allocationUsers: AllocationUserDto[];
}
