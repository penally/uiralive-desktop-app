import type { MediaSource } from '../lib/types';
import { tmdbApi } from '../../../lib/tmdb';
import { sendExtensionRequest, setDomainRule, RULE_IDS, isExtensionActive } from '@/backend/extension';
import { loadServersWasm } from './wasmLoader';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

interface DecryptedResponse {
	sources: Array<{ url: string }>;
}

export async function fetchVideasySources(
	tmdbId: number,
	season?: number,
	episode?: number
): Promise<MediaSource[]> {
	try {
		// Check if extension is available
		const extensionAvailable = await isExtensionActive();
		if (!extensionAvailable) {
			console.log('Videasy: Extension not available, skipping');
			return [];
		}

		const isShow = season !== undefined && episode !== undefined;
		const mediaType = isShow ? 'show' : 'movie';

		// Fetch title + year from TMDB
		let title = '';
		let year = new Date().getFullYear();

		if (isShow) {
			const tv = await tmdbApi.getTVDetails(tmdbId);
			title = tv.name || '';
			if (tv.first_air_date) {
				year = parseInt(tv.first_air_date.split('-')[0]);
			}
		} else {
			const movie = await tmdbApi.getMovieDetails(tmdbId);
			title = movie.title || '';
			if (movie.release_date) {
				year = parseInt(movie.release_date.split('-')[0]);
			}
		}

		const wasm = await loadServersWasm();
		if (!wasm) return [];

		const videasyUrl = wasm.buildVideasySourcesUrl(
			title,
			mediaType,
			String(year),
			tmdbId,
			season ?? 0,
			episode ?? 0
		);

		// 1. Get encrypted response via extension
		const encryptedResponse = await sendExtensionRequest<string>({
			url: videasyUrl,
			method: 'GET',
			headers: { 'User-Agent': UA },
		});

		if (!encryptedResponse?.success) {
			console.log('Videasy: Failed to fetch encrypted response');
			return [];
		}

		const encrypted = encryptedResponse.response.body;

		// 2. Decrypt using enc-dec via extension
		const decryptResponse = await sendExtensionRequest<DecryptedResponse>({
			url: wasm.buildVideasyDecryptUrl(),
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': UA
			},
			body: JSON.stringify({
				text: encrypted,
				id: String(tmdbId),
			}),
		});

		if (!decryptResponse?.success) {
			console.log('Videasy: Failed to decrypt response');
			return [];
		}

		const decrypted = decryptResponse.response.body;

		if (!decrypted.sources || !decrypted.sources.length) return [];

		// Set up domain rule for HLS streaming via extension
		const sourceUrl = decrypted.sources[0].url;
		const sourceDomain = new URL(sourceUrl).hostname;
		await setDomainRule({
			ruleId: RULE_IDS.SET_DOMAINS_HLS,
			targetDomains: [sourceDomain],
			requestHeaders: {
				'Referer': 'https://api.videasy.net/',
				'Origin': 'https://api.videasy.net'
			},
		});

		return [
			{
				url: sourceUrl,
				headers: {},
				quality: 'Auto',
				name: 'Videasy',
				speed: '—',
				size: '—',
				type: 'hls'
			},
		];
	} catch (err) {
		console.error('Error fetching Videasy sources:', err);
		return [];
	}
}
