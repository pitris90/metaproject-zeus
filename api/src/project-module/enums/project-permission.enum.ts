export enum ProjectPermissionEnum {
	REQUEST_ALLOCATION = 'request_allocation', // allows to request allocation for a project
	EDIT_PROJECT = 'edit_project', // edit of project details
	EDIT_MEMBERS = 'edit_members', // edit normal project members
	EDIT_MANAGERS = 'edit_managers', // manipulate with managers
	EDIT_PUBLICATIONS = 'edit_publications', // edit publications
	VIEW_PROJECT = 'view_project', // view basic project detail
	VIEW_ALL_MEMBERS = 'view_all_members', // view all members (pending and inactive included)
	VIEW_ADVANCED_DETAILS = 'view_advanced_details', // view advanced project details,
	VIEW_ALL_ALLOCATIONS = 'view_all_allocations' // view all allocations
}
