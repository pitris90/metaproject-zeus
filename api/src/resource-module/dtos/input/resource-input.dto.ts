export class ResourceInputDto {
	name: string;
	description: string;
	isAvailable: boolean;
	resourceTypeId: number;
	parentResourceId?: number;
	attributes: {
		key: string;
		value: string;
	}[];
}
