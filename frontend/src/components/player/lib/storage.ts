const STORAGE_PREFIX = 'uira-player-';
const CONTINUE_WATCHING_KEY = `${STORAGE_PREFIX}continue_watching`;
const WATCH_PARTY_GUEST_ID_KEY = `${STORAGE_PREFIX}watch_party_guest_id`;
const WATCH_PARTY_GUEST_NAME_KEY = `${STORAGE_PREFIX}watch_party_guest_name`;

/** Stable guest ID for watch party (persists across joins) */
export function getOrCreateGuestId(): string {
	try {
		let id = localStorage.getItem(WATCH_PARTY_GUEST_ID_KEY);
		if (!id || !id.startsWith('anon_')) {
			id = `anon_${Math.random().toString(36).slice(2, 12)}`;
			localStorage.setItem(WATCH_PARTY_GUEST_ID_KEY, id);
		}
		return id;
	} catch {
		return `anon_${Math.random().toString(36).slice(2, 12)}`;
	}
}

/** Saved guest display name for watch party */
export function getGuestDisplayName(): string | null {
	try {
		return localStorage.getItem(WATCH_PARTY_GUEST_NAME_KEY);
	} catch {
		return null;
	}
}

export function setGuestDisplayName(name: string | null): void {
	try {
		if (name) localStorage.setItem(WATCH_PARTY_GUEST_NAME_KEY, name);
		else localStorage.removeItem(WATCH_PARTY_GUEST_NAME_KEY);
	} catch {}
}

export interface ContinueWatchingItem {
	tmdbId: number;
	type: 'movie' | 'tv';
	season?: number;
	episode?: number;
	progress: number; // time in seconds
	duration: number; // total duration in seconds
	lastWatched: number; // timestamp
	title?: string;
	name?: string;
	poster_path?: string | null;
	backdrop_path?: string | null;
	release_date?: string;
	first_air_date?: string;
	vote_average?: number;
}

function getProgressKey(tmdbId: number, season?: number, episode?: number): string {
	if (season !== undefined && episode !== undefined) {
		return `${STORAGE_PREFIX}progress_${tmdbId}_${season}_${episode}`;
	}
	return `${STORAGE_PREFIX}progress_${tmdbId}`;
}

export interface MediaMeta {
	title?: string;
	name?: string;
	poster_path?: string | null;
	backdrop_path?: string | null;
	release_date?: string;
	first_air_date?: string;
	vote_average?: number;
}

export function saveProgress(tmdbId: number, time: number, duration?: number, season?: number, episode?: number, meta?: MediaMeta) {
	try {
		const key = getProgressKey(tmdbId, season, episode);
		localStorage.setItem(key, time.toString());
		
		if (duration !== undefined) {
			localStorage.setItem(`${key}_duration`, duration.toString());
		}
		
		updateContinueWatching(tmdbId, time, duration, season, episode, meta);
	} catch (e) {
		console.warn('Failed to save progress:', e);
	}
}

export function getProgress(tmdbId: number, season?: number, episode?: number): number {
	try {
		const key = getProgressKey(tmdbId, season, episode);
		const saved = localStorage.getItem(key);
		return saved ? parseFloat(saved) : 0;
	} catch (e) {
		console.warn('Failed to get progress:', e);
		return 0;
	}
}

export function getProgressDuration(tmdbId: number, season?: number, episode?: number): number {
	try {
		const key = getProgressKey(tmdbId, season, episode);
		const saved = localStorage.getItem(`${key}_duration`);
		return saved ? parseFloat(saved) : 0;
	} catch (e) {
		console.warn('Failed to get progress duration:', e);
		return 0;
	}
}

function updateContinueWatching(tmdbId: number, progress: number, duration: number | undefined, season?: number, episode?: number, meta?: MediaMeta) {
	if (progress < 10) return; // only track after 10 seconds of watch time
	try {
		const items = getContinueWatchingItems();
		const type = season !== undefined && episode !== undefined ? 'tv' : 'movie';
		
		const existingIndex = items.findIndex(item => {
			if (item.type === 'tv' && season !== undefined && episode !== undefined) {
				return item.tmdbId === tmdbId && item.season === season && item.episode === episode;
			}
			return item.tmdbId === tmdbId && item.type === 'movie';
		});
		
		const existingMeta = existingIndex >= 0 ? {
			title: items[existingIndex].title,
			name: items[existingIndex].name,
			poster_path: items[existingIndex].poster_path,
			backdrop_path: items[existingIndex].backdrop_path,
			release_date: items[existingIndex].release_date,
			first_air_date: items[existingIndex].first_air_date,
			vote_average: items[existingIndex].vote_average,
		} : {};

		const item: ContinueWatchingItem = {
			tmdbId,
			type,
			season,
			episode,
			progress,
			duration: duration || 0,
			lastWatched: Date.now(),
			...existingMeta,
			...(meta || {}),
		};
		
		if (existingIndex >= 0) {
			items[existingIndex] = item;
		} else {
			items.push(item);
		}
		
		items.sort((a, b) => b.lastWatched - a.lastWatched);
		const limitedItems = items.slice(0, 50);
		
		localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(limitedItems));
	} catch (e) {
		console.warn('Failed to update continue watching:', e);
	}
}

export function getContinueWatchingItems(): ContinueWatchingItem[] {
	try {
		const saved = localStorage.getItem(CONTINUE_WATCHING_KEY);
		return saved ? (JSON.parse(saved) as ContinueWatchingItem[]) : [];
	} catch (e) {
		console.warn('Failed to get continue watching items:', e);
		return [];
	}
}

export function removeContinueWatchingItem(tmdbId: number, season?: number, episode?: number) {
	try {
		const items = getContinueWatchingItems();
		const filtered = items.filter(item => {
			if (item.type === 'tv' && season !== undefined && episode !== undefined) {
				return !(item.tmdbId === tmdbId && item.season === season && item.episode === episode);
			}
			return !(item.tmdbId === tmdbId && item.type === 'movie');
		});
		localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(filtered));
		
		// Also remove progress
		const key = getProgressKey(tmdbId, season, episode);
		localStorage.removeItem(key);
		localStorage.removeItem(`${key}_duration`);
	} catch (e) {
		console.warn('Failed to remove continue watching item:', e);
	}
}

export function updateContinueWatchingOrder(items: ContinueWatchingItem[]) {
	try {
		localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(items));
	} catch (e) {
		console.warn('Failed to update continue watching order:', e);
	}
}

export function saveSettings(settings: Record<string, any>) {
	try {
		localStorage.setItem(`${STORAGE_PREFIX}settings`, JSON.stringify(settings));
	} catch (e) {
		console.warn('Failed to save settings:', e);
	}
}

export function getSettings(): Record<string, any> {
	try {
		const saved = localStorage.getItem(`${STORAGE_PREFIX}settings`);
		return saved ? (JSON.parse(saved) as Record<string, any>) : {};
	} catch (e) {
		console.warn('Failed to get settings:', e);
		return {};
	}
}

export function getFemboxToken(): string | null {
	try {
		return localStorage.getItem(`${STORAGE_PREFIX}fembox_token`);
	} catch (e) {
		console.warn('Failed to get Fembox token:', e);
		return null;
	}
}

export function saveFemboxToken(token: string): void {
	try {
		localStorage.setItem(`${STORAGE_PREFIX}fembox_token`, token);
	} catch (e) {
		console.warn('Failed to save Fembox token:', e);
	}
}

export function getRegion(): string | null {
	try {
		return localStorage.getItem(`${STORAGE_PREFIX}region`);
	} catch (e) {
		console.warn('Failed to get region:', e);
		return null;
	}
}

export function saveRegion(region: string): void {
	try {
		localStorage.setItem(`${STORAGE_PREFIX}region`, region);
	} catch (e) {
		console.warn('Failed to save region:', e);
	}
}

const LANGUAGE_KEY = 'uira-language';

export function getPreferredLanguage(): string {
	try {
		const stored = localStorage.getItem(LANGUAGE_KEY);
		return stored && stored.trim().length > 0 ? stored : 'en-US';
	} catch (e) {
		console.warn('Failed to get language:', e);
		return 'en-US';
	}
}

export function savePreferredLanguage(lang: string): void {
	try {
		localStorage.setItem(LANGUAGE_KEY, lang);
	} catch (e) {
		console.warn('Failed to save language:', e);
	}
}

