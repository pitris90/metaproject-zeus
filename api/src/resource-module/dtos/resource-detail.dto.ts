class AttributeDetailDto {
	key: string;
	value: string;
	isPublic: boolean;
	isRequired: boolean;
	type: string;
}

export class ResourceDetailDto {
	id: number;
	name: string;
	description: string;
	isAvailable: boolean;
	resourceType: {
		id: number;
		name: string;
	};
	parentResource?: {
		id: number;
		name: string;
	};
	attributes?: AttributeDetailDto[];
}
