class AttributeDto {
	key: string;
	value: string;
}

export class ResourceInputDto {
	name: string;
	description: string;
	isAvailable: boolean;
	resourceTypeId: number;
	parentResourceId?: number;
	attributes: AttributeDto[];
}
