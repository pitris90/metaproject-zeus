import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
	Allocation,
	AllocationOpenstackPayload,
	AllocationOpenstackRequest,
	AllocationStatus,
	AllocationUser,
	OpenstackRequestStatus,
	Project,
	Resource
} from 'resource-manager-database';
import { AllocationRequestDto } from '../dtos/allocation-request.dto';
import { ProjectPermissionService } from '../../project-module/services/project-permission.service';
import { ProjectPermissionEnum } from '../../project-module/enums/project-permission.enum';
import { Sorting } from '../../config-module/decorators/get-sorting';
import { Pagination } from '../../config-module/decorators/get-pagination';
import { AllocationNotFoundError } from '../../error-module/errors/allocations/allocation-not-found.error';
import { AllocationStatusDto } from '../dtos/input/allocation-status.dto';
import {
	OpenstackAllocationService,
	MergeRequestState
} from '../../openstack-module/services/openstack-allocation.service';
import { OpenstackAllocationExistsError } from '../../error-module/errors/allocations/openstack-allocation-exists.error';
import { OpenstackPersonalProjectError } from '../../error-module/errors/allocations/openstack-personal-project.error';
import { AllocationMapper } from '../mappers/allocation.mapper';
import { AllocationDetailDto } from '../dtos/allocation-detail.dto';
import { AllocationAdminDto } from '../dtos/allocation-admin.dto';

/** Resource name that identifies OpenStack resources for restriction checks */
const OPENSTACK_RESOURCE_NAME = 'OpenStack';

@Injectable()
export class AllocationService {
	private readonly allocationMapper = new AllocationMapper();

	constructor(
		private readonly dataSource: DataSource,
		private readonly projectPermissionService: ProjectPermissionService,
		private readonly openstackAllocationService: OpenstackAllocationService
	) {}

	async request(projectId: number, userId: number, allocation: AllocationRequestDto, isStepUp: boolean) {
		const { openstack, ...allocationData } = allocation;

		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.REQUEST_ALLOCATION,
				isStepUp
			);

			const resource = await manager.getRepository(Resource).findOne({
				relations: {
					resourceType: true
				},
				where: {
					id: allocationData.resourceId
				}
			});

			if (!resource) {
				throw new BadRequestException('Resource not found for allocation request.');
			}

			const resourceTypeName = resource.resourceType?.name ?? '';
			const isOpenstackResource = resourceTypeName
				? this.openstackAllocationService.isResourceTypeSupported(resourceTypeName)
				: false;

			// Fetch project for OpenStack validation and to get description
			let project: Project | null = null;

			// Check OpenStack-specific restrictions when requesting an OpenStack resource
			if (isOpenstackResource || resource.name === OPENSTACK_RESOURCE_NAME) {
				// Check if project is personal
				project = await manager.getRepository(Project).findOne({
					where: { id: projectId }
				});

				if (project?.isPersonal) {
					throw new OpenstackPersonalProjectError();
				}

				// Check if an active OpenStack allocation already exists for this project
				const existingActiveAllocation = await manager
					.createQueryBuilder(Allocation, 'allocation')
					.innerJoin('allocation.resource', 'resource')
					.where('allocation.projectId = :projectId', { projectId })
					.andWhere('allocation.status = :status', { status: AllocationStatus.ACTIVE })
					.andWhere('resource.name = :resourceName', { resourceName: OPENSTACK_RESOURCE_NAME })
					.getOne();

				if (existingActiveAllocation) {
					throw new OpenstackAllocationExistsError();
				}
			}

			if (isOpenstackResource && !openstack) {
				throw new BadRequestException('OpenStack details are required for this resource.');
			}

			if (!isOpenstackResource && openstack) {
				throw new BadRequestException('OpenStack details can be supplied only for OpenStack resources.');
			}

			// Set startDate to current date when request is created
			const startDate = new Date();
			// Set endDate from disableDate if provided for OpenStack allocations
			let endDate: Date | undefined = undefined;
			if (isOpenstackResource && openstack?.disableDate) {
				endDate = this.parseDisableDate(openstack.disableDate);
			}

			const allocationInsertResult = await manager
				.createQueryBuilder()
				.insert()
				.into(Allocation)
				.values({
					projectId,
					resourceId: allocationData.resourceId,
					justification: allocationData.justification,
					quantity: allocationData.quantity,
					status: AllocationStatus.NEW,
					startDate,
					endDate
				})
				.returning('id')
				.execute();

			const createdAllocationId = Number(allocationInsertResult.identifiers[0]['id']);

			await manager
				.createQueryBuilder()
				.insert()
				.into(AllocationUser)
				.values({
					userId,
					allocationId: createdAllocationId,
					status: AllocationStatus.NEW
				})
				.execute();

			if (isOpenstackResource && openstack) {
				// Use project description from database instead of user-provided value
				const projectDescription = project?.description ?? '';

				const payload: AllocationOpenstackPayload = {
					domain: openstack.domain,
					disableDate: openstack.disableDate,
					projectDescription,
					customerKey: openstack.customerKey,
					organizationKey: openstack.organizationKey,
					workplaceKey: openstack.workplaceKey,
					quota: openstack.quota ?? {},
					additionalTags: openstack.additionalTags,
					flavors: openstack.flavors,
					networks: openstack.networks
				};

				this.openstackAllocationService.validateRequestPayload(payload);

				await manager
					.createQueryBuilder()
					.insert()
					.into(AllocationOpenstackRequest)
					.values({
						allocationId: createdAllocationId,
						status: OpenstackRequestStatus.PENDING,
						payload
					})
					.execute();
			}
		});
	}

	async getDetail(userId: number, allocationId: number, isStepUp: boolean): Promise<AllocationDetailDto> {
		const allocation = await this.dataSource.getRepository(Allocation).findOne({
			select: {
				id: true,
				project: {
					id: true,
					title: true
				},
				resource: {
					id: true,
					name: true,
					resourceType: {
						name: true
					}
				},
				justification: true,
				startDate: true,
				endDate: true,
				status: true,
				description: true,
				quantity: true,
				isLocked: true,
				isChangeable: true,
				time: {
					updatedAt: true
				},
				allocationUsers: {
					userId: true,
					user: {
						id: true,
						name: true,
						email: true
					}
				}
			},
			where: {
				id: allocationId
			},
			relations: ['resource', 'resource.resourceType', 'project', 'allocationUsers', 'allocationUsers.user']
		});

		const projectId = allocation?.project?.id;
		if (!allocation || !projectId) {
			throw new AllocationNotFoundError();
		}

		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId, isStepUp);
		const userHasAccess = allocation.allocationUsers.some((au) => au.userId === userId);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_ALL_ALLOCATIONS) && !userHasAccess) {
			throw new AllocationNotFoundError();
		}

		// Fetch OpenStack requests separately (ordered by id DESC - newest first)
		const openstackRequests = await this.dataSource.getRepository(AllocationOpenstackRequest).find({
			where: { allocationId },
			order: { id: 'DESC' }
		});

		// Fetch MR states for all requests that have a merge request URL
		const mrStates = new Map<number, MergeRequestState | null>();
		for (const request of openstackRequests) {
			if (request.mergeRequestUrl) {
				const state = await this.openstackAllocationService.getMergeRequestState(request.mergeRequestUrl);
				mrStates.set(request.id, state);
			} else {
				mrStates.set(request.id, null);
			}
		}

		return this.allocationMapper.toAllocationDetailDto(allocation, openstackRequests, mrStates);
	}

	async list(projectId: number, userId: number, pagination: Pagination, sorting: Sorting | null, isStepUp: boolean) {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId, isStepUp);

		const allocationBuilder = this.dataSource
			.createQueryBuilder()
			.select('a')
			.from(Allocation, 'a')
			.innerJoinAndSelect('a.allocationUsers', 'allUsers')
			.innerJoinAndSelect('allUsers.user', 'u')
			.leftJoinAndSelect('a.resource', 'r')
			.leftJoinAndSelect('r.resourceType', 'rt')
			.where('a.projectId = :projectId', { projectId })
			.offset(pagination.offset)
			.limit(pagination.limit);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_ALL_ALLOCATIONS)) {
			const existsInAllocationQuery = this.dataSource
				.createQueryBuilder()
				.select('au')
				.from(AllocationUser, 'au')
				.where('au.allocationId = a.id')
				.andWhere('au.userId = :userId')
				.getQuery();

			allocationBuilder.andWhere(`EXISTS (${existsInAllocationQuery})`, {
				userId
			});
		}

		if (sorting) {
			switch (sorting.columnAccessor) {
				case 'name':
					allocationBuilder.orderBy('r.name', sorting.direction);
					break;
				case 'type':
					allocationBuilder.orderBy('rt.name', sorting.direction);
					break;
				case 'endDate':
					allocationBuilder.orderBy('a.endDate', sorting.direction);
					break;
				case 'status':
					allocationBuilder.orderBy('a.status', sorting.direction);
					break;
			}
		}

		return allocationBuilder.getManyAndCount();
	}

	async setStatus(allocationId: number, data: AllocationStatusDto) {
		const allocation = await this.dataSource.getRepository(Allocation).findOne({
			where: { id: allocationId }
		});

		if (!allocation) {
			throw new AllocationNotFoundError();
		}

		const isActivating = data.status === AllocationStatus.ACTIVE;
		const isModificationApproval = allocation.status === AllocationStatus.ACTIVE && isActivating;

		// Get the latest OpenStack request
		const latestRequest = await this.dataSource.getRepository(AllocationOpenstackRequest).findOne({
			where: { allocationId },
			order: { id: 'DESC' }
		});

		if (isActivating && latestRequest) {
			// Approve the OpenStack request
			await this.dataSource
				.getRepository(AllocationOpenstackRequest)
				.update({ id: latestRequest.id }, { status: OpenstackRequestStatus.APPROVED });

			// Process the approved allocation (creates MR)
			await this.openstackAllocationService.processApprovedAllocation(allocationId);
		}

		// Handle denial
		if (data.status === AllocationStatus.DENIED && latestRequest) {
			// Deny the OpenStack request
			await this.dataSource
				.getRepository(AllocationOpenstackRequest)
				.update({ id: latestRequest.id }, { status: OpenstackRequestStatus.DENIED });
		}

		// For modification approval, don't change allocation status (it stays active)
		if (isModificationApproval) {
			// Just update description if provided
			if (data.description) {
				await this.dataSource
					.getRepository(Allocation)
					.update({ id: allocationId }, { description: data.description });
			}
			return;
		}

		// For modification denial, don't change allocation status
		if (allocation.status === AllocationStatus.ACTIVE && data.status === AllocationStatus.DENIED) {
			// Just update description if provided, keep allocation active
			if (data.description) {
				await this.dataSource
					.getRepository(Allocation)
					.update({ id: allocationId }, { description: data.description });
			}
			return;
		}

		const date = new Date();
		date.setFullYear(date.getFullYear() + 1);

		const newDate = data.status === 'denied' ? undefined : date;

		await this.dataSource.getRepository(Allocation).update(
			{
				id: allocationId
			},
			{
				status: data.status as AllocationStatus,
				startDate: data.startDate,
				endDate: data.endDate ? data.endDate : newDate,
				description: data.description
			}
		);
	}

	async getAll(
		status: 'new' | 'pending-modification' | null,
		pagination: Pagination,
		sorting: Sorting
	): Promise<[AllocationAdminDto[], number]> {
		const allocationQuery = this.dataSource
			.createQueryBuilder(Allocation, 'allocation')
			.innerJoinAndSelect('allocation.project', 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.innerJoinAndSelect('allocation.resource', 'resource')
			.innerJoinAndSelect('resource.resourceType', 'resourceType')
			.offset(pagination.offset)
			.limit(pagination.limit);

		if (status === 'new') {
			allocationQuery.where('allocation.status = :status', { status: AllocationStatus.NEW });
		} else if (status === 'pending-modification') {
			// Filter for active allocations that have a pending OpenStack request
			allocationQuery
				.innerJoin(AllocationOpenstackRequest, 'osr', 'osr.allocationId = allocation.id')
				.where('allocation.status = :activeStatus', { activeStatus: AllocationStatus.ACTIVE })
				.andWhere('osr.status = :pendingStatus', { pendingStatus: OpenstackRequestStatus.PENDING })
				// Ensure we get the latest request
				.andWhere((qb) => {
					const subQuery = qb
						.subQuery()
						.select('MAX(osr2.id)')
						.from(AllocationOpenstackRequest, 'osr2')
						.where('osr2.allocationId = allocation.id')
						.getQuery();
					return `osr.id = ${subQuery}`;
				});
		}

		switch (sorting.columnAccessor) {
			case 'project':
				allocationQuery.orderBy('project.title', sorting.direction);
				break;
			case 'id':
				allocationQuery.orderBy('allocation.id', sorting.direction);
				break;
			case 'pi':
				allocationQuery.orderBy('pi.name', sorting.direction);
				break;
			case 'status':
				allocationQuery.orderBy('allocation.status', sorting.direction);
				break;
			case 'resource':
				allocationQuery.orderBy('resource.name', sorting.direction);
				break;
			case 'endDate':
				allocationQuery.orderBy('allocation.endDate', sorting.direction);
				break;
			default:
				allocationQuery.orderBy('allocation.id', sorting.direction);
				break;
		}

		const [allocations, count] = await allocationQuery.getManyAndCount();

		// Fetch latest OpenStack request for each allocation and MR states
		const adminDtos: AllocationAdminDto[] = [];
		for (const allocation of allocations) {
			const latestRequest = await this.dataSource.getRepository(AllocationOpenstackRequest).findOne({
				where: { allocationId: allocation.id },
				order: { id: 'DESC' }
			});

			let mrState: MergeRequestState | null = null;
			if (latestRequest?.mergeRequestUrl) {
				mrState = await this.openstackAllocationService.getMergeRequestState(latestRequest.mergeRequestUrl);
			}

			adminDtos.push(this.allocationMapper.toAllocationAdminDto(allocation, latestRequest, mrState));
		}

		return [adminDtos, count];
	}

	/**
	 * Creates a modification request for an active OpenStack allocation.
	 * This creates a new AllocationOpenstackRequest with status 'pending'.
	 * Note: projectDescription is automatically taken from project.description in the database.
	 */
	async modifyOpenstackAllocation(
		allocationId: number,
		userId: number,
		modifyData: {
			disableDate?: string;
			customerKey: string;
			organizationKey: string;
			workplaceKey: string;
			quota: Record<string, number>;
			additionalTags?: string[];
			flavors?: string[];
			networks?: { accessAsExternal?: string[]; accessAsShared?: string[] };
		},
		isStepUp: boolean
	): Promise<void> {
		// Get the allocation with resource info
		const allocation = await this.dataSource.getRepository(Allocation).findOne({
			relations: {
				resource: {
					resourceType: true
				},
				project: true
			},
			where: { id: allocationId }
		});

		if (!allocation) {
			throw new AllocationNotFoundError();
		}

		// Check user has permission to modify this allocation
		const userPermissions = await this.projectPermissionService.getUserPermissions(
			allocation.projectId,
			userId,
			isStepUp
		);

		if (!userPermissions.has(ProjectPermissionEnum.REQUEST_ALLOCATION)) {
			throw new BadRequestException('You do not have permission to modify this allocation.');
		}

		// Check allocation is active
		if (allocation.status !== AllocationStatus.ACTIVE) {
			throw new BadRequestException('Only active allocations can be modified.');
		}

		// Check allocation is changeable
		if (!allocation.isChangeable) {
			throw new BadRequestException('This allocation does not support modifications.');
		}

		// Check it's an OpenStack allocation
		const resourceTypeName = allocation.resource?.resourceType?.name ?? '';
		if (!this.openstackAllocationService.isResourceTypeSupported(resourceTypeName)) {
			throw new BadRequestException('This allocation is not an OpenStack allocation.');
		}

		// Get the latest OpenStack request
		const latestRequest = await this.dataSource.getRepository(AllocationOpenstackRequest).findOne({
			where: { allocationId },
			order: { id: 'DESC' }
		});

		if (!latestRequest) {
			throw new BadRequestException('No OpenStack request found for this allocation.');
		}

		// Check latest request is not pending
		if (latestRequest.status === OpenstackRequestStatus.PENDING) {
			throw new BadRequestException('Cannot modify allocation while there is a pending request.');
		}

		// If latest request is approved, check MR is not opened
		if (latestRequest.status === OpenstackRequestStatus.APPROVED) {
			const mrState = await this.openstackAllocationService.getMergeRequestState(latestRequest.mergeRequestUrl);

			// If GitLab is unavailable, don't allow modification
			if (mrState === null) {
				throw new BadRequestException('Cannot verify merge request status. Please try again later.');
			}

			// If MR is still opened, don't allow modification
			if (mrState === 'opened') {
				throw new BadRequestException('Cannot modify allocation while merge request is still open.');
			}
		}

		// Get the domain from the latest approved request (domain cannot be changed)
		const latestApprovedRequest = await this.dataSource.getRepository(AllocationOpenstackRequest).findOne({
			where: {
				allocationId,
				status: OpenstackRequestStatus.APPROVED
			},
			order: { id: 'DESC' }
		});

		if (!latestApprovedRequest) {
			throw new BadRequestException('No approved request found to base modification on.');
		}

		const domain = latestApprovedRequest.payload.domain;

		// Use project description from database instead of user-provided value
		const projectDescription = allocation.project?.description ?? '';

		// Validate the new payload
		const payload: AllocationOpenstackPayload = {
			domain,
			disableDate: modifyData.disableDate,
			projectDescription,
			customerKey: modifyData.customerKey,
			organizationKey: modifyData.organizationKey,
			workplaceKey: modifyData.workplaceKey,
			quota: modifyData.quota ?? {},
			additionalTags: modifyData.additionalTags,
			flavors: modifyData.flavors,
			networks: modifyData.networks
		};

		this.openstackAllocationService.validateRequestPayload(payload);

		// Update allocation endDate if disableDate changed
		if (modifyData.disableDate) {
			const newEndDate = this.parseDisableDate(modifyData.disableDate);
			if (newEndDate) {
				await this.dataSource.getRepository(Allocation).update({ id: allocationId }, { endDate: newEndDate });
			}
		}

		// Create a new modification request
		await this.dataSource.getRepository(AllocationOpenstackRequest).insert({
			allocationId,
			status: OpenstackRequestStatus.PENDING,
			payload
		});
	}

	/**
	 * Parses a disableDate string from OpenStack allocation request.
	 * Supports formats: YYYY-MM-DD, DD.MM.YYYY, or 'unlimited' (returns undefined).
	 */
	private parseDisableDate(disableDate: string): Date | undefined {
		if (!disableDate || disableDate === 'unlimited') {
			return undefined;
		}

		// Try YYYY-MM-DD format
		if (/^\d{4}-\d{2}-\d{2}$/.test(disableDate)) {
			return new Date(disableDate);
		}

		// Try DD.MM.YYYY format
		if (/^\d{2}\.\d{2}\.\d{4}$/.test(disableDate)) {
			const [day, month, year] = disableDate.split('.');
			return new Date(`${year}-${month}-${day}`);
		}

		return undefined;
	}
}
