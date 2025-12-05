class AllocationUserDto {
	id: number;
	name: string;
	email: string;
}

/**
 * OpenStack request status
 */
export type OpenstackRequestStatusDto = 'pending' | 'approved' | 'denied';

/**
 * Merge request state from GitLab
 */
export type MergeRequestStateDto = 'merged' | 'opened' | 'closed' | null;

/**
 * Single OpenStack allocation request
 */
export class OpenstackRequestDto {
	/**
	 * Request ID
	 */
	id: number;

	/**
	 * Request status (pending, approved, denied)
	 */
	status: OpenstackRequestStatusDto;

	/**
	 * OpenStack domain
	 */
	domain: string;

	/**
	 * Disable date for the OpenStack project
	 */
	disableDate?: string | null;

	/**
	 * Customer key tag
	 */
	customerKey: string;

	/**
	 * Organization key tag
	 */
	organizationKey: string;

	/**
	 * Workplace key tag
	 */
	workplaceKey: string;

	/**
	 * Additional OpenStack tags
	 */
	additionalTags?: string[];

	/**
	 * Quota configuration
	 */
	quota: Record<string, number>;

	/**
	 * Assigned flavors
	 */
	flavors?: string[];

	/**
	 * Network ACL configuration
	 */
	networks?: {
		accessAsExternal?: string[];
		accessAsShared?: string[];
	};

	/**
	 * Whether the request has been processed (MR created)
	 */
	processed: boolean;

	/**
	 * When the request was processed
	 */
	processedAt: string | null;

	/**
	 * GitLab merge request URL
	 */
	mergeRequestUrl: string | null;

	/**
	 * Git branch name
	 */
	branchName: string | null;

	/**
	 * Path to the YAML file in the repository
	 */
	yamlPath: string | null;

	/**
	 * Current state of the merge request (from GitLab API)
	 */
	mergeRequestState: MergeRequestStateDto;

	/**
	 * When the request was created
	 */
	createdAt: string;
}

export class AllocationDetailDto {
	/**
	 * Allocation id
	 */
	id: number;

	/**
	 * Allocation status
	 */
	status: string;

	/**
	 * Allocation start date
	 */
	startDate: string;

	/**
	 * Allocation end date
	 */
	endDate: string;

	project: {
		id: number;
		title: string;
	};

	/**
	 * Allocation resource
	 */
	resource: {
		/**
		 * Allocation resource id
		 */
		id: number;
		/**
		 * Allocation resource name
		 */
		name: string;

		/**
		 * Allocation resource type
		 */
		type: string;
	};

	/**
	 * Allocation justification
	 */
	justification: string;

	/**
	 * Allocation description
	 */
	description: string;

	/**
	 * Allocation quantity
	 */
	quantity: number | null;

	/**
	 * Allocation is locked
	 */
	isLocked: boolean;

	updatedAt: string;

	allocationUsers: AllocationUserDto[];

	/**
	 * Latest OpenStack allocation request (if this is an OpenStack allocation)
	 */
	openstack?: OpenstackRequestDto;

	/**
	 * History of previous OpenStack requests (newest first, excluding the latest)
	 */
	openstackHistory?: OpenstackRequestDto[];

	/**
	 * Whether the user can submit a modification request for this OpenStack allocation
	 */
	canModifyOpenstack?: boolean;

	/**
	 * Resource isChangeable flag
	 */
	isChangeable: boolean;
}
