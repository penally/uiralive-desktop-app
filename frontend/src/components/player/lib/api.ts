import type { SubtitleTrack } from './types';



// Wyzie Subs API: https://sub.wyzie.ru
// Movies: /search?id=286217
// TV:     /search?id=tmdbid&season=1&episode=1
export const WYZIE_API_BASE = 'https://sub.wyzie.ru';


interface WyzieSubtitle {
	id: string | number;
	url: string;
	flagUrl?: string | null;
	format?: string;
	encoding?: string;
	display?: string;
	language?: string;
	media?: string;
	isHearingImpaired?: boolean;
	source?: string;
}

// Map category names to ISO 639-1 language codes
const languageCodeMap: Record<string, string> = {
	'English': 'en',
	'Spanish': 'es',
	'French': 'fr',
	'German': 'de',
	'Italian': 'it',
	'Portuguese': 'pt',
	'Portuguese (BR)': 'pt-BR',
	'Brazilian': 'pt-BR',
	'Russian': 'ru',
	'Japanese': 'ja',
	'Korean': 'ko',
	'Chinese': 'zh',
	'Arabic': 'ar',
	'Dutch': 'nl',
	'Polish': 'pl',
	'Turkish': 'tr',
	'Swedish': 'sv',
	'Norwegian': 'no',
	'Danish': 'da',
	'Finnish': 'fi',
	'Czech': 'cs',
	'Romanian': 'ro',
	'Greek': 'el',
	'Hungarian': 'hu',
	'Thai': 'th',
	'Vietnamese': 'vi',
	'Indonesian': 'id',
	'Hebrew': 'he',
	'Hindi': 'hi'
};

function getLanguageCode(category: string): string {
	// Check exact match first
	if (languageCodeMap[category]) {
		return languageCodeMap[category];
	}
	
	// Check if category starts with a mapped language
	for (const [key, code] of Object.entries(languageCodeMap)) {
		if (category.toLowerCase().startsWith(key.toLowerCase())) {
			return code;
		}
	}
	
	// Fallback: use first word lowercase
	return category.toLowerCase().split(' ')[0].split('(')[0].trim();
}


async function fetchWyzieSubtitles(tmdbId: number, season?: number, episode?: number): Promise<SubtitleTrack[]> {
	try {
		let url = `${WYZIE_API_BASE}/search?id=${tmdbId}`;
		if (season !== undefined && episode !== undefined) {
			url = `${WYZIE_API_BASE}/search?id=${tmdbId}&season=${season}&episode=${episode}`;
		}

		const response = await fetch(url);
		if (!response.ok) {
			console.warn('Failed to fetch Wyzie subtitles:', response.statusText);
			return [];
		}

		const data = (await response.json()) as WyzieSubtitle[];
		if (!Array.isArray(data)) return [];

		const tracks: SubtitleTrack[] = [];

		data.forEach((item) => {
			if (!item.url) return;

			const display = item.display || item.language || 'Unknown';
			const languageCode =
				(item.language && item.language.length <= 5 ? item.language : undefined) ||
				getLanguageCode(display);

			tracks.push({
				id: `wyzie-${item.id}`,
				label: display,
				language: display,
				src: item.url,
				srclang: languageCode || 'und',
				url: item.url,
				flagUrl: item.flagUrl || undefined,
				format: item.format,
				encoding: item.encoding,
				display,
				isHearingImpaired: item.isHearingImpaired,
				source: 'wyzie',
				default: false
			});
		});

		return tracks;
	} catch (error) {
		console.error('Error fetching subtitles from Wyzie:', error);
		return [];
	}
}

export async function fetchSubtitles(tmdbId: number, season?: number, episode?: number): Promise<SubtitleTrack[]> {
	return await fetchWyzieSubtitles(tmdbId, season, episode);
}


