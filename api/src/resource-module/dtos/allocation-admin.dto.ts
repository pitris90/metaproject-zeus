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
	openstack?: {
		domain: string | null;
		organizationKey: string | null;
		processed: boolean;
		mergeRequestUrl: string | null;
	};
}
