export class ProjectRequestExistsException extends Error {
	constructor() {
		super('Project request already exists');
	}
}
