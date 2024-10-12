import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Allocation, AllocationStatus, AllocationUser } from 'resource-manager-database';
import { AllocationRequestDto } from '../dtos/allocation-request.dto';
import { ProjectPermissionService } from '../../project-module/services/project-permission.service';
import { ProjectPermissionEnum } from '../../project-module/enums/project-permission.enum';

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
}
