export class ProjectFileDto {
	/**
	 * The file's id
	 *
	 * @example 1
	 */
	id: number;

	/**
	 * The file's name
	 *
	 * @example "file.txt"
	 */
	name: string;

	/**
	 * The file's size in bytes
	 *
	 * @example 1024
	 */
	size: number;

	/**
	 * The file's mime
	 *
	 * @example "application/pdf"
	 */
	mime: string;

	/**
	 * The file's creation date. ISO format.
	 */
	createdAt: string;
}
