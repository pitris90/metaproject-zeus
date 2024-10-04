import { AttributeDto } from './attribute.dto';

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
	attributes?: AttributeDto[];
}
