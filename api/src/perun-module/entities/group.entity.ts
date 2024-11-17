export type Group = {
	id: number;
	createdAt: string;
	createdBy: string;
	modifiedAt: string;
	modifiedBy: string;
	createdByUid: number;
	modifiedByUid: number;
	voId: number | null;
	parentGroupId: number | null;
	name: string;
	description: string;
	uuid: string;
	shortName: string;
	beanName: string;
};
