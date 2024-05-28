export class UserDto {
	/**
	 * ID of the user
	 *
	 * @example 1
	 */
	id: number;
	/**
	 * Source of user's registration. Typically name of the service like "perun", "google", "facebook" and so on...
	 *
	 * @example "perun"
	 */
	source: string;
	/**
	 * User's external ID in the source system
	 *
	 * @example 12345
	 */
	externalId: number;
	/**
	 * User's username
	 *
	 * @example "johndoe"
	 */
	username: string;
	/**
	 * User's full name
	 *
	 * @example "John Doe"
	 */
	name: string;
}
