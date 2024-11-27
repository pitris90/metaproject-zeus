export class AllocationAdminDto {
	id: number;
	project: {
		id: number;
		title: string;
		pi: {
			name: string;
		};
	};
	resource: {
		name: string;
		type: string;
	};
	status: string;
	endDate: string | null;
}
