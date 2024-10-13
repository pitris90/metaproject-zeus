export class AllocationDto {
	id: number;
	status: string;
	endDate: Date | null;
	resource: {
		name: string;
		type: string;
	};
}
