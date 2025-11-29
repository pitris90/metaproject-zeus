import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

/**
 * DTO for network ACL configuration.
 * Networks can be assigned to access_as_external and/or access_as_shared.
 */
export class OpenstackNetworksDto {
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	accessAsExternal?: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	accessAsShared?: string[];
}

export class OpenstackAllocationRequestDto {
	@IsString()
	@IsNotEmpty()
	@Matches(/^[a-z0-9][a-z0-9_.-]*$/)
	domain: string;

	@IsOptional()
	@IsString()
	@Matches(/^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|unlimited)$/)
	disableDate?: string;

	@IsString()
	@IsNotEmpty()
	projectDescription: string;

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
