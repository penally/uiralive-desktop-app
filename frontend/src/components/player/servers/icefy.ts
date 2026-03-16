import type { MediaSource } from '../lib/types';
import { loadServersWasm } from './wasmLoader';

export async function fetchIcefySources(
	tmdbId: number,
	mediaType: 'movie' | 'tv' = 'movie',
	season?: number,
	episode?: number
): Promise<MediaSource[]> {
	const wasm = await loadServersWasm();
	if (!wasm) return [];
	try {
		const url = wasm.buildIcefyUrl(tmdbId, mediaType, season ?? 0, episode ?? 0);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);
		const response = await fetch(url, {
			signal: controller.signal,
			method: 'GET',
			headers: { 'Accept': 'application/vnd.apple.mpegurl, */*' }
		});
		clearTimeout(timeoutId);
		if (!response.ok) return [];
		const text = await response.text();
		const json = wasm.parseIcefyResponse(url, text);
		const parsed = JSON.parse(json) as MediaSource[];
		return parsed;
	} catch (err) {
		if (err instanceof Error && err.name !== 'AbortError') {
			console.warn('Icefy WASM error:', err.message);
		}
		return [];
	}
}
