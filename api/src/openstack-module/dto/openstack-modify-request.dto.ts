import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { OpenstackNetworksDto } from './openstack-allocation-request.dto';

/**
 * DTO for modifying an existing OpenStack allocation.
 * Domain is not included as it cannot be changed during modification.
 */
export class OpenstackModifyRequestDto {
	@IsOptional()
	@IsString()
	@Matches(/^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|unlimited)$/)
	disableDate?: string;

	@IsString()
	@IsNotEmpty()
	customerKey: string;

	@IsString()
	@IsNotEmpty()
	organizationKey: string;

	@IsString()
	@IsNotEmpty()
	workplaceKey: string;

	@IsObject()
	quota: Record<string, number>;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	additionalTags?: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	flavors?: string[];

	@IsOptional()
	@ValidateNested()
	@Type(() => OpenstackNetworksDto)
	networks?: OpenstackNetworksDto;
}
