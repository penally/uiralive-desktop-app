import type { MediaSource } from '../lib/types';
import { sendExtensionRequest, setDomainRule, RULE_IDS, isExtensionActive } from '@/backend/extension';
import { loadServersWasm } from './wasmLoader';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export async function fetchVixsrcSources(
	tmdbId: number,
	mediaType: 'movie' | 'tv' = 'movie',
	season?: number,
	episode?: number
): Promise<MediaSource[]> {
	try {
		const extensionAvailable = await isExtensionActive();
		if (!extensionAvailable) {
			console.log('Vixsrc: Extension not available, skipping');
			return [];
		}

		const wasm = await loadServersWasm();
		if (!wasm) return [];

		const pageUrl = wasm.buildVixsrcPageUrl(tmdbId, mediaType, season ?? 0, episode ?? 0);

		const response = await sendExtensionRequest<string>({
			url: pageUrl,
			method: 'GET',
			headers: { 'User-Agent': UA, Referer: 'https://vixsrc.to/' },
		});

		if (!response?.success) {
			console.log('Vixsrc: Extension request failed');
			return [];
		}

		const html = response.response.body;
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const scripts = Array.from(doc.querySelectorAll('script'));
		const scriptTag = scripts.find((s) => s.textContent && s.textContent.includes('window.masterPlaylist'));

		if (!scriptTag?.textContent) throw new Error('Vixsrc: masterPlaylist script not found');

		const scriptContent = scriptTag.textContent;
		const parsed = wasm.parseVixsrcScript(scriptContent);
		const data = JSON.parse(parsed) as { videoId?: string; token?: string; expires?: string };
		if (!data.videoId || !data.token || !data.expires) throw new Error('Vixsrc: parse failed');

		const playlistUrl = wasm.buildVixsrcPlaylistUrl(
			data.videoId,
			encodeURIComponent(data.token),
			encodeURIComponent(data.expires)
		);

		const playlistDomain = new URL(playlistUrl).hostname;
		const targetDomains = [playlistDomain, 'vix-content.net'];

		await setDomainRule({
			ruleId: RULE_IDS.SET_DOMAINS_HLS,
			targetDomains,
			requestHeaders: {
				'Referer': 'https://vixsrc.to/',
				'Origin': 'https://vixsrc.to'
			},
		});

		return [
			{
				url: playlistUrl,
				headers: {},
				quality: 'Auto',
				name: 'Vixsrc',
				speed: '—',
				size: '—',
				type: 'hls'
			}
		];
	} catch (err) {
		console.error('Vixsrc fetch error:', err);
		return [];
	}
}
