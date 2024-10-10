export class ResourceAttributeDto {
	id: number;
	name: string;
	isPublic: boolean;
	isRequired: boolean;
	attributeType: {
		id: number;
		name: string;
	};
	hasResources: boolean;
}
