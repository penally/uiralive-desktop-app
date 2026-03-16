import type { MediaSource, ProviderSubtitle } from '../lib/types';
import { getFemboxToken, getRegion } from '../lib/storage';
import type { SubServer } from './index';
import { loadServersWasm } from './wasmLoader';

function getCookie(): string | null {
	return getFemboxToken();
}

export interface FemboxResult {
	sources: MediaSource[];
	subtitles: ProviderSubtitle[];
}

interface FemboxApiResponse {
	sources: {
		url: string;
		quality: string;
		size: string;
	}[];
	subtitles: ProviderSubtitle[];
}

interface FemboxHlsResponse {
	hls: string;
	subtitles: Array<{
		language: string;
		url: string;
		name?: string;
		upload_date?: string;
	}>;
}

export async function fetchFemboxSources(
	tmdbId: number,
	season?: number,
	episode?: number
): Promise<FemboxResult> {
	try {
		const token = getCookie();
		if (!token) {
			return { sources: [], subtitles: [] };
		}

		if (season !== undefined && episode !== undefined) {
			return await fetchFemboxTVSources(tmdbId, season, episode);
		}

		const wasm = await loadServersWasm();
		if (!wasm) return { sources: [], subtitles: [] };

		const url = wasm.buildFemboxMovieUrl(tmdbId, token);
		const response = await fetch(url);

		if (response.status === 404) {
			return { sources: [], subtitles: [] };
		}

		if (!response.ok) {
			throw new Error(`Failed to fetch media sources: ${response.statusText}`);
		}

		const data = (await response.json()) as FemboxApiResponse;

		if (!data.sources || data.sources.length === 0) {
			return { sources: [], subtitles: data.subtitles || [] };
		}

		const sourcesWithName: MediaSource[] = data.sources.map((source) => ({
			url: encodeURIComponent(source.url),
			quality: source.quality,
			size: source.size,
			name: `Fembox ${source.quality}`,
			type: 'video',
			speed: '1',
			useProxy: false
		}));

		return {
			sources: sourcesWithName,
			subtitles: data.subtitles || []
		};
	} catch (error) {
		console.error('Error fetching Fembox sources:', error);
		return { sources: [], subtitles: [] };
	}
}

async function fetchFemboxTVSources(
	tmdbId: number,
	season: number,
	episode: number
): Promise<FemboxResult> {
	try {
		const token = getCookie();
		if (!token) {
			return { sources: [], subtitles: [] };
		}

		const wasm = await loadServersWasm();
		if (!wasm) return { sources: [], subtitles: [] };

		const region = getRegion() || '';
		const url = wasm.buildFemboxTvUrl(tmdbId, season, episode, token, region);
		const response = await fetch(url);

		if (response.status === 404) {
			return { sources: [], subtitles: [] };
		}

		if (!response.ok) {
			throw new Error(`Failed to fetch TV sources: ${response.statusText}`);
		}

		const data = (await response.json()) as FemboxApiResponse;

		if (!data.sources || data.sources.length === 0) {
			return { sources: [], subtitles: data.subtitles || [] };
		}

		const sourcesWithName: MediaSource[] = data.sources.map((source) => ({
			url: encodeURIComponent(source.url),
			quality: source.quality,
			size: source.size,
			name: `Fembox ${source.quality}`,
			type: 'video',
			speed: '1',
			useProxy: true
		}));

		return {
			sources: sourcesWithName,
			subtitles: data.subtitles || []
		};
	} catch (error) {
		console.error('Error fetching Fembox TV sources:', error);
		return { sources: [], subtitles: [] };
	}
}

export async function fetchFemboxHlsSources(
	tmdbId: number,
	season?: number,
	episode?: number
): Promise<FemboxResult> {
	try {
		const token = getCookie();
		if (!token) {
			return { sources: [], subtitles: [] };
		}

		const wasm = await loadServersWasm();
		if (!wasm) return { sources: [], subtitles: [] };

		const region = getRegion() || '';
		const mediaType = season !== undefined && episode !== undefined ? 'tv' : 'movie';
		const url = wasm.buildFemboxHlsUrl(tmdbId, mediaType, season ?? 0, episode ?? 0, token, region);

		const response = await fetch(url);

		if (response.status === 404) {
			return { sources: [], subtitles: [] };
		}

		if (!response.ok) {
			throw new Error(`Failed to fetch HLS sources: ${response.statusText}`);
		}

		const data = (await response.json()) as FemboxHlsResponse;

		if (!data.hls) {
			return { sources: [], subtitles: [] };
		}

		const hlsSource: MediaSource = {
			url: data.hls,
			quality: 'HLS',
			name: 'Fembox HLS',
			speed: '1',
			size: '0',
			type: 'hls'
		};

		const subtitles: ProviderSubtitle[] = (data.subtitles || []).map((sub, index) => ({
			id: index,
			label: sub.language,
			display: sub.language,
			language: sub.language.toLowerCase(),
			lang: sub.language.toLowerCase(),
			srclang: sub.language.toLowerCase(),
			url: sub.url,
			src: sub.url,
			file: sub.url
		}));

		return {
			sources: [hlsSource],
			subtitles
		};
	} catch (error) {
		console.error('Error fetching Fembox HLS sources:', error);
		return { sources: [], subtitles: [] };
	}
}

export async function getFemboxSubServers(
	tmdbId: number,
	season?: number,
	episode?: number
): Promise<SubServer[]> {
	const token = getCookie();
	if (!token) {
		return [];
	}

	try {
		const subServers: SubServer[] = [];

		const [hlsResult, mp4Result] = await Promise.allSettled([
			fetchFemboxHlsSources(tmdbId, season, episode),
			fetchFemboxSources(tmdbId, season, episode)
		]);

		if (hlsResult.status === 'fulfilled' && hlsResult.value.sources.length > 0) {
			subServers.push({
				id: 'fembox-hls',
				name: 'HLS',
				sources: hlsResult.value.sources
			});
		}

		if (mp4Result.status === 'fulfilled' && mp4Result.value.sources.length > 0) {
			subServers.push({
				id: 'fembox-mp4',
				name: 'MP4',
				sources: mp4Result.value.sources
			});
		}

		return subServers;
	} catch (error) {
		console.error('Error getting Fembox subservers:', error);
		return [];
	}
}