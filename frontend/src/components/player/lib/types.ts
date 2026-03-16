export interface MediaSource {
	url: string;
	quality: string;
	name: string;
	speed: string;
	size: string;
	type: string;
	headers?: Record<string, string>;
	/**
	 * If true, the Player will route this source through `/api/cors-proxy`.
	 * Default is false (direct playback).
	 */
	useProxy?: boolean;
}

export interface ProviderSubtitle {
	id?: string | number;
	label?: string;
	display?: string;
	language?: string;
	lang?: string;
	srclang?: string;
	url?: string;
	file?: string;
	src?: string;
	flagUrl?: string;
	isHearingImpaired?: boolean;
}

export interface MediaResponse {
	success: boolean;
	links: MediaSource[];
	subtitles?: ProviderSubtitle[];
}

export interface SubtitleTrack {
	id: string;
	label: string;
	language: string;
	src: string;
	srclang: string;
	default?: boolean;
	url?: string;
	flagUrl?: string;
	format?: string;
	encoding?: string;
	display?: string;
	isHearingImpaired?: boolean;
	source?: string;
}

export interface PlayerSettings {
	quality: string;
	subtitle: SubtitleTrack | null;
	subtitleSize: number;
	subtitleColor: string;
	subtitleBackground: string;
	subtitlePosition: number;
	subtitleDelay?: number;
	volume: number;
	playbackRate: number;
	/**
	 * If true (default), TV episodes will auto-advance at credits (or 5s before end).
	 */
	autoNext?: boolean;
	subtitleFontFamily?: string;
	subtitleFontWeight?: string;
	subtitleFontStyle?: string;
	subtitleTextDecoration?: string;
	subtitleBgOpacity?: number;
	subtitleBgEnabled?: boolean;
	subtitleAutoDetect?: boolean;
	subtitleOpacity?: number;
	fixSubtitles?: boolean;
	fixCapitalization?: boolean;
}

export interface PlayerState {
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	buffered: number;
	volume: number;
	isFullscreen: boolean;
	isSettingsOpen: boolean;
	isControlsVisible: boolean;
	quality: string;
	loading: boolean;
	error: string | null;
}

