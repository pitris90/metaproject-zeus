import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { OpenstackAllocationRequestDto } from '../../openstack-module/dto/openstack-allocation-request.dto';

export class AllocationRequestDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	resourceId: number;

	@IsString()
	@IsNotEmpty()
	justification: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	quantity?: number;

	@IsOptional()
	@ValidateNested()
	@Type(() => OpenstackAllocationRequestDto)
	openstack?: OpenstackAllocationRequestDto;
}
