import type { MediaSource } from './types';

export type VideoFormat = 'hls' | 'mp4' | 'mkv' | 'other';

/**
 * Detect video format from URL
 */
export function getVideoFormat(source: MediaSource): VideoFormat {
	const url = source.url.toLowerCase();
	const type = source.type?.toLowerCase();

	if (type === 'hls' || url.includes('.m3u8') || url.endsWith('.m3u8')) {
		return 'hls';
	}
	if (url.includes('.mp4') || url.endsWith('.mp4')) {
		return 'mp4';
	}
	if (url.includes('.mkv') || url.endsWith('.mkv')) {
		return 'mkv';
	}
	return 'other';
}

/**
 * Get the playback URL for a source.
 */
export function getPlaybackUrl(source: MediaSource, _origin: string): string {
	return source.url;
}

/**
 * Check if native HLS is supported (Safari)
 */
export function hasNativeHlsSupport(): boolean {
	if (typeof document === 'undefined') return false;
	const video = document.createElement('video');
	return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Sort sources by format preference: HLS > MP4 > MKV > other
 * (most compatible first)
 */
export function sortSourcesByCompatibility(sources: MediaSource[]): MediaSource[] {
	const order: Record<VideoFormat, number> = {
		hls: 0,
		mp4: 1,
		mkv: 2,
		other: 3
	};
	return [...sources].sort((a, b) => {
		const fmtA = getVideoFormat(a);
		const fmtB = getVideoFormat(b);
		return order[fmtA] - order[fmtB];
	});
}