export class ResourceDto {
	id: number;
	name: string;
	isAvailable: boolean;
	resourceType: {
		id: number;
		name: string;
	};
	parentResourceId?: number;
}
