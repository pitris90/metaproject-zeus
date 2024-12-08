import { IsDateString, IsIn, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class AllocationStatusDto {
	@IsDateString()
	@IsOptional()
	startDate: string;

	@ValidateIf((o) => o.status !== 'denied')
	@IsNotEmpty()
	@IsDateString()
	endDate: string;

	@IsIn(['new', 'active', 'revoked', 'denied', 'expired'])
	@IsNotEmpty()
	status: string;

	@IsOptional()
	description?: string;
}
