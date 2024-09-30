export class ResourceTypeDto {
	/**
	 * Resource type ID
	 *
	 * @example 1
	 */
	id: number;
	/**
	 * Resource type name
	 *
	 * @example "Server"
	 */
	name: string;

	/**
	 * Resource type description
	 *
	 * @example "A server is a computer program or a device that provides functionality for other programs or devices, called clients."
	 *
	 */
	description: string;

	/**
	 * Returns true if the resource type has resources
	 *
	 * @example true
	 */
	hasResources: boolean;
}
