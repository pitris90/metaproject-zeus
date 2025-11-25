/**
 * Converts a string into a URL-friendly slug
 * @param value - The string to slugify
 * @returns A lowercase, hyphenated slug
 */
export function slugify(value: string): string {
	if (!value) return '';

	const base = value.normalize('NFKD');
	return base
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_-]+/g, '-')
		.replace(/-+/g, '-')
		.toLowerCase();
}
