import { Publication } from 'resource-manager-database';

export class PublicationAddedEvent {
	constructor(
		public readonly projectId: number,
		public readonly publication: Publication
	) {}
}
