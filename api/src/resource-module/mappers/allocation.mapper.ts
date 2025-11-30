import {
	Allocation,
	AllocationOpenstackRequest,
	AllocationStatus,
	OpenstackRequestStatus
} from 'resource-manager-database';
import { AllocationDto } from '../dtos/allocation.dto';
import {
	AllocationDetailDto,
	MergeRequestStateDto,
	OpenstackRequestDto,
	OpenstackRequestStatusDto
} from '../dtos/allocation-detail.dto';
import { AllocationAdminDto } from '../dtos/allocation-admin.dto';
import { MergeRequestState } from '../../openstack-module/services/openstack-git.service';

/**
 * Maps OpenStack request status enum to DTO string
 */
function mapOpenstackRequestStatus(status: OpenstackRequestStatus): OpenstackRequestStatusDto {
	switch (status) {
		case OpenstackRequestStatus.APPROVED:
			return 'approved';
		case OpenstackRequestStatus.DENIED:
			return 'denied';
		case OpenstackRequestStatus.PENDING:
		default:
			return 'pending';
	}
}

/**
 * Maps MR state to DTO
 */
function mapMergeRequestState(state: MergeRequestState | null): MergeRequestStateDto {
	return state;
}

/**
 * Determines if an OpenStack allocation can be modified.
 * Conditions:
 * - Allocation status is active
 * - Resource isChangeable is true
 * - Latest request status is NOT pending
 * - If latest request status is approved, MR must NOT be 'opened'
 * - If MR state is null (GitLab unavailable), don't allow modification
 */
function canModifyOpenstackAllocation(
	allocationStatus: AllocationStatus,
	isChangeable: boolean,
	latestRequest: AllocationOpenstackRequest | null,
	mrState: MergeRequestState | null
): boolean {
	if (allocationStatus !== AllocationStatus.ACTIVE) {
		return false;
	}

	if (!isChangeable) {
		return false;
	}

	if (!latestRequest) {
		return false;
	}

	// Don't allow if latest request is pending (waiting for admin decision)
	if (latestRequest.status === OpenstackRequestStatus.PENDING) {
		return false;
	}

	// If latest request is approved, check MR state
	if (latestRequest.status === OpenstackRequestStatus.APPROVED) {
		// If GitLab is unavailable (null), don't allow modification
		if (mrState === null) {
			return false;
		}
		// Don't allow if MR is still opened
		if (mrState === 'opened') {
			return false;
		}
	}

	// If latest request is denied, user can try again
	return true;
}

export class AllocationMapper {
	toAllocationDto(allocation: Allocation): AllocationDto {
		return {
			id: allocation.id,
			status: allocation.status,
			endDate: allocation.endDate,
			resource: {
				name: allocation.resource.name,
				type: allocation.resource.resourceType.name
			},
			allocationUsers: allocation.allocationUsers.map((allocationUser) => ({
				id: allocationUser.userId,
				name: allocationUser.user.name,
				email: allocationUser.user.email
			}))
		};
	}

	toAllocationDetailDto(
		allocation: Allocation,
		openstackRequests: AllocationOpenstackRequest[],
		mrStates: Map<number, MergeRequestState | null>
	): AllocationDetailDto {
		// Sort requests by id DESC (newest first)
		const sortedRequests = [...openstackRequests].sort((a, b) => b.id - a.id);
		const latestRequest = sortedRequests[0] ?? null;
		const historyRequests = sortedRequests.slice(1);

		const latestMrState = latestRequest ? (mrStates.get(latestRequest.id) ?? null) : null;

		const mapRequestToDto = (request: AllocationOpenstackRequest): OpenstackRequestDto => {
			const mrState = mrStates.get(request.id) ?? null;
			return {
				id: request.id,
				status: mapOpenstackRequestStatus(request.status),
				domain: request.payload?.domain ?? '',
				disableDate: request.payload?.disableDate ?? null,
				projectDescription: request.payload?.projectDescription ?? '',
				customerKey: request.payload?.customerKey ?? '',
				organizationKey: request.payload?.organizationKey ?? '',
				workplaceKey: request.payload?.workplaceKey ?? '',
				additionalTags: request.payload?.additionalTags,
				quota: request.payload?.quota ?? {},
				flavors: request.payload?.flavors,
				networks: request.payload?.networks,
				processed: request.processed,
				processedAt: request.processedAt?.toISOString() ?? null,
				mergeRequestUrl: request.mergeRequestUrl,
				branchName: request.branchName,
				yamlPath: request.yamlPath,
				mergeRequestState: mapMergeRequestState(mrState),
				createdAt: request.time?.createdAt ?? new Date().toISOString()
			};
		};

		const openstack = latestRequest ? mapRequestToDto(latestRequest) : undefined;
		const openstackHistory = historyRequests.length > 0 ? historyRequests.map(mapRequestToDto) : undefined;

		const resourceTypeName = allocation.resource?.resourceType?.name ?? '';
		const isOpenstackResource = resourceTypeName.toLowerCase() === 'cloud';
		const isChangeable = allocation.isChangeable ?? true;

		const canModify = isOpenstackResource
			? canModifyOpenstackAllocation(allocation.status, isChangeable, latestRequest, latestMrState)
			: undefined;

		return {
			id: allocation.id,
			status: allocation.status,
			startDate: allocation.startDate?.toString() ?? null,
			endDate: allocation.endDate?.toString() ?? null,
			resource: {
				id: allocation.resource.id,
				name: allocation.resource.name,
				type: allocation.resource.resourceType.name
			},
			justification: allocation.justification,
			description: allocation.description,
			quantity: allocation.quantity,
			isLocked: allocation.isLocked,
			isChangeable,
			project: {
				id: allocation.project.id,
				title: allocation.project.title
			},
			updatedAt: allocation.time.updatedAt,
			allocationUsers: allocation.allocationUsers.map((allocationUser) => ({
				id: allocationUser.userId,
				name: allocationUser.user.name,
				email: allocationUser.user.email
			})),
			openstack,
			openstackHistory,
			canModifyOpenstack: canModify
		};
	}

	toAllocationAdminDto(
		allocation: Allocation,
		latestOpenstackRequest: AllocationOpenstackRequest | null,
		mrState: MergeRequestState | null
	): AllocationAdminDto {
		const openstack = latestOpenstackRequest
			? {
					id: latestOpenstackRequest.id,
					requestStatus: mapOpenstackRequestStatus(latestOpenstackRequest.status),
					domain: latestOpenstackRequest.payload?.domain ?? null,
					organizationKey: latestOpenstackRequest.payload?.organizationKey ?? null,
					processed: latestOpenstackRequest.processed,
					mergeRequestUrl: latestOpenstackRequest.mergeRequestUrl,
					mergeRequestState: mapMergeRequestState(mrState)
				}
			: undefined;

		// Check if this allocation has a pending modification
		// (active allocation with a pending OpenStack request)
		const hasPendingModification =
			allocation.status === AllocationStatus.ACTIVE &&
			latestOpenstackRequest?.status === OpenstackRequestStatus.PENDING;

		return {
			id: allocation.id,
			status: allocation.status,
			endDate: allocation.endDate ? allocation.endDate.toString() : null,
			resource: {
				name: allocation.resource.name,
				type: allocation.resource.resourceType.name
			},
			project: {
				id: allocation.project.id,
				title: allocation.project.title,
				pi: {
					name: allocation.project.pi.name
				}
			},
			openstack,
			hasPendingModification
		};
	}
}
