import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { RolesCheck } from '../../permission-module/decorators/roles.decorator';
import { RequestUser } from '../../auth-module/decorators/user.decorator';
import { UserDto } from '../../users-module/dtos/user.dto';
import { AllocationRequestDto } from '../dtos/allocation-request.dto';
import { AllocationService } from '../services/allocation.service';

@Controller('/allocation')
export class AllocationController {
	constructor(private readonly allocationService: AllocationService) {}

	@Post('/request/:projectId')
	@RolesCheck([RoleEnum.USER, RoleEnum.ADMIN])
	@HttpCode(201)
	async requestAllocation(
		@Param('projectId') projectId: number,
		@RequestUser() user: UserDto,
		@Body() allocation: AllocationRequestDto
	) {
		await this.allocationService.request(projectId, user.id, allocation);
	}
}
