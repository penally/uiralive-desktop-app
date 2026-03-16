const INTRO_API_BASE = 'https://api.theintrodb.org/v1';

interface IntroData {
	start_ms: number | null;
	end_ms: number | null;
	confidence: number;
	submission_count: number;
}

interface IntroResponse {
	tmdb_id: number;
	type: 'movie' | 'tv';
	intro?: IntroData;
	recap?: IntroData;
	credits?: IntroData;
}

export interface IntroSegments {
	intro?: { start: number; end: number; confidence: number };
	recap?: { start: number; end: number; confidence: number };
	credits?: { start: number; end: number; confidence: number }; // end can be -1 to indicate use video duration
}

/**
 * Fetch intro/recap/credits data from theintrodb.org
 * @param tmdbId - The TMDB ID
 * @param season - Optional season number for TV shows
 * @param episode - Optional episode number for TV shows
 * @returns Intro segments with start/end times in seconds
 */
export async function fetchIntroData(
	tmdbId: number,
	season?: number,
	episode?: number
): Promise<IntroSegments> {
	try {
		let url = `${INTRO_API_BASE}/media?tmdb_id=${tmdbId}`;
		if (season !== undefined && episode !== undefined) {
			url += `&season=${season}&episode=${episode}`;
		}

		const response = await fetch(url);
		
		if (!response.ok) {
			return {};
		}

		const data = (await response.json()) as IntroResponse;
		
		const segments: IntroSegments = {};
		
		// Convert milliseconds to seconds and handle null values
		// For intro: if start_ms is null, use 0 (beginning of video)
		if (data.intro && data.intro.end_ms !== null) {
			segments.intro = {
				start: (data.intro.start_ms ?? 0) / 1000,
				end: data.intro.end_ms / 1000,
				confidence: data.intro.confidence
			};
		}
		
		// For recap: both start and end must be present
		if (data.recap && data.recap.start_ms !== null && data.recap.end_ms !== null) {
			segments.recap = {
				start: data.recap.start_ms / 1000,
				end: data.recap.end_ms / 1000,
				confidence: data.recap.confidence
			};
		}
		
		// For credits: if end_ms is null, we'll use video duration (handled in Player.svelte)
		if (data.credits && data.credits.start_ms !== null) {
			segments.credits = {
				start: data.credits.start_ms / 1000,
				end: data.credits.end_ms ? data.credits.end_ms / 1000 : -1, // -1 means use video duration
				confidence: data.credits.confidence
			};
		}
		
		return segments;
	} catch (error) {
		console.error('[Intro] Error fetching intro data:', error);
		return {};
	}
}

