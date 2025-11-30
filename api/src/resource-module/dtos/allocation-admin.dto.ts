import { MergeRequestStateDto, OpenstackRequestStatusDto } from './allocation-detail.dto';

export class AllocationAdminDto {
	id: number;
	project: {
		id: number;
		title: string;
		pi: {
			name: string;
		};
	};
	resource: {
		name: string;
		type: string;
	};
	status: string;
	endDate: string | null;
	openstack?: {
		/**
		 * Request ID
		 */
		id: number;
		/**
		 * Request status (pending, approved, denied)
		 */
		requestStatus: OpenstackRequestStatusDto;
		domain: string | null;
		organizationKey: string | null;
		processed: boolean;
		mergeRequestUrl: string | null;
		/**
		 * Current state of the merge request (from GitLab API)
		 */
		mergeRequestState: MergeRequestStateDto;
	};
	/**
	 * Whether this allocation has a pending OpenStack modification request
	 */
	hasPendingModification?: boolean;
}
