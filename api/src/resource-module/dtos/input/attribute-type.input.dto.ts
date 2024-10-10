import { IsNotEmpty } from 'class-validator';

export class AttributeTypeInputDto {
	@IsNotEmpty()
	name: string;
	isRequired: boolean;
	isPublic: boolean;
	@IsNotEmpty()
	attributeTypeId: number;
}
