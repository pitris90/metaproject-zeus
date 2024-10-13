import { Allocation } from 'resource-manager-database';
import { AllocationDto } from '../dtos/allocation.dto';

export class AllocationMapper {
	toAllocationDto(allocation: Allocation): AllocationDto {
		return {
			id: allocation.id,
			status: allocation.status,
			endDate: allocation.endDate,
			resource: {
				name: allocation.resource.name,
				type: allocation.resource.resourceType.name
			}
		};
	}
}
