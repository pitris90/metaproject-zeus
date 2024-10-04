import { AttributeDto } from '../attribute.dto';

export class ResourceInputDto {
	name: string;
	description: string;
	isAvailable: boolean;
	resourceTypeId: number;
	parentResourceId?: number;
	attributes: AttributeDto[];
}
