import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Allocation, AllocationStatus, AllocationUser } from 'resource-manager-database';
import { AllocationRequestDto } from '../dtos/allocation-request.dto';
import { ProjectPermissionService } from '../../project-module/services/project-permission.service';
import { ProjectPermissionEnum } from '../../project-module/enums/project-permission.enum';
import { Sorting } from '../../config-module/decorators/get-sorting';
import { Pagination } from '../../config-module/decorators/get-pagination';

@Injectable()
export class AllocationService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly projectPermissionService: ProjectPermissionService
	) {}

	async request(projectId: number, userId: number, allocation: AllocationRequestDto) {
		await this.dataSource.transaction(async (manager) => {
			await this.projectPermissionService.validateUserPermissions(
				manager,
				projectId,
				userId,
				ProjectPermissionEnum.REQUEST_ALLOCATION
			);

			// create allocation
			const result = await manager
				.createQueryBuilder()
				.insert()
				.into(Allocation)
				.values({
					projectId,
					...allocation,
					status: AllocationStatus.NEW
				})
				.returning('id')
				.execute();

			// add user to allocation
			await manager
				.createQueryBuilder()
				.insert()
				.into(AllocationUser)
				.values({
					userId,
					allocationId: result.identifiers[0]['id'],
					status: AllocationStatus.NEW
				})
				.execute();
		});
	}

	async list(projectId: number, userId: number, pagination: Pagination, sorting: Sorting | null) {
		const userPermissions = await this.projectPermissionService.getUserPermissions(projectId, userId);

		const allocationBuilder = this.dataSource
			.createQueryBuilder()
			.select('a')
			.from(Allocation, 'a')
			.leftJoinAndSelect('a.resource', 'r')
			.leftJoinAndSelect('r.resourceType', 'rt')
			.where('a.projectId = :projectId', { projectId })
			.offset(pagination.offset)
			.limit(pagination.limit);

		if (!userPermissions.has(ProjectPermissionEnum.VIEW_ALL_ALLOCATIONS)) {
			allocationBuilder.andWhereExists(
				this.dataSource
					.createQueryBuilder()
					.select('au')
					.from(AllocationUser, 'au')
					.where('au.allocationId = a.id')
					.andWhere('au.userId = :userId', { userId })
					.subQuery()
			);
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
}
