import { IsInt, IsOptional, IsString, IsIn, IsEmail, MaxLength, Min } from 'class-validator';

export class CreateMockUserDto {
	@IsOptional()
	@IsInt()
	@Min(1)
	id?: number;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	externalId?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(255)
	email?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	username?: string;

	@IsOptional()
	@IsString()
	@MaxLength(10)
	locale?: string;

	@IsOptional()
	@IsIn(['admin', 'director', 'user'])
	role?: 'admin' | 'director' | 'user';
}
