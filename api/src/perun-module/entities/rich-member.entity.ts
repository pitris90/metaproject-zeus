import { PerunUser } from './user.entity';

export type RichMember = {
	id: number;
	createdAt: string;
	createdBy: string;
	modifiedAt: string;
	createdByUid: number;
	modifiedByUuid: number;
	userId: number;
	voId: number;
	status: string;
	membershipType: string;
	sourceGroupId: number | null;
	sponsored: boolean;
	user: PerunUser;
	userAttributes: string[];
	memberAttributes: string[];
	groupStatus: string;
	groupStatuses: Record<string, string>;
	beanName: 'RichMember';
};
