import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

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
	@Matches(/^[a-z0-9][a-z0-9_.-]*$/)
	mainTag: string;

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
}
