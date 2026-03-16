/**
 * Runtime origin guard - extraction logic only runs on allowed domains.
 * Prevents reuse of server extraction code when embedded elsewhere.
 */

const ALLOWED_ORIGINS = [
	'https://uira.live',
	'https://www.uira.live',
	'https://beta.uira.live',
	'http://localhost',
	'http://127.0.0.1'
];

function isAllowedOrigin(): boolean {
	if (typeof window === 'undefined') return true;
	const o = window.location.origin;
	return ALLOWED_ORIGINS.some(a => o === a || o.startsWith(a + ':'));
}

/**
 * Wraps a fetchSources-like function to return empty results when not on allowed origin.
 */
export function guardExtraction<T>(
	fn: () => Promise<T>,
	fallback: T
): Promise<T> {
	if (!isAllowedOrigin()) return Promise.resolve(fallback);
	return fn();
}

export { isAllowedOrigin };
