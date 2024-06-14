/**
 * String enum must equal to code name saved in database for correct mapping
 */
export enum PermissionEnum {
	REQUEST_PROJECT = 'request_project',
	GET_OWNED_PROJECTS = 'get_owned_projects',
	PROJECT_APPROVAL = 'project_approval',
	MANIPULATE_OWNED_PROJECTS = 'manipulate_owned_projects',
	GET_ALL_PROJECTS = 'get_all_projects',
	MANIPULATE_ALL_PROJECTS = 'manipulate_all_projects',
	CLOSE_PROJECT = 'close_project'
}
