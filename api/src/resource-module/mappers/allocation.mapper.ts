import { Allocation } from 'resource-manager-database';
import { AllocationDto } from '../dtos/allocation.dto';
import { AllocationDetailDto } from '../dtos/allocation-detail.dto';
import { AllocationAdminDto } from '../dtos/allocation-admin.dto';

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

	toAllocationDetailDto(allocation: Allocation): AllocationDetailDto {
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
			project: {
				id: allocation.project.id,
				title: allocation.project.title
			},
			updatedAt: allocation.time.updatedAt,
			allocationUsers: allocation.allocationUsers.map((allocationUser) => ({
				id: allocationUser.userId,
				name: allocationUser.user.name,
				email: allocationUser.user.email
			}))
		};
	}

	toAllocationAdminDto(allocation: Allocation): AllocationAdminDto {
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
			}
		};
	}
}
