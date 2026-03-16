// Types
import type { MediaSource, ProviderSubtitle } from '../lib/types';

// Utilities
import { getServerOrder } from '../lib/serverStorage';
import { getFemboxToken } from '../lib/storage';

// Server imports
import { fetchFemboxSources, fetchFemboxHlsSources, getFemboxSubServers } from './fembox';
import { guardExtraction } from './domainGuard';
import { requireWasmGate } from './wasmGate';
import { fetchIcefySources } from './icefy';
import { showbox } from './showbox';
import { fetchVideasySources } from './videasy';
import { fetchVixsrcSources } from './vixsrc';
import { fetchPasmellsSources, getPasmellsSubServers } from './pasmells';

// Helper functions
function getMediaType(season?: number, episode?: number): 'movie' | 'tv' {
	return season !== undefined && episode !== undefined ? 'tv' : 'movie';
}

/** WASM gate + domain guard - all servers require valid lease when lease mode is on. */
async function withProtection<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
	const ok = await requireWasmGate();
	if (!ok) return fallback;
	return guardExtraction(fn, fallback);
}

export interface SubServer {
	id: string;
	name: string;
	sources: MediaSource[];
}

export interface ServerConfig {
	id: string;
	name: string;
	enabled: boolean;
	order: number;
	disabled?: boolean; // Can be set in server file to disable by default
	/**
	 * If true, all sources from this server will be played via `/api/cors-proxy`.
	 * Default is false (direct playback).
	 */
	useProxy?: boolean;
	/**
	 * If true, this server requires the browser extension to be installed and active.
	 * Default is false (no extension required).
	 */
	extensionRequired?: boolean;
	fetchSources: (tmdbId: number, season?: number, episode?: number, subServerName?: string) => Promise<MediaSource[]>;
	getSubtitles?: (tmdbId: number, season?: number, episode?: number, subServerName?: string) => Promise<ProviderSubtitle[]>;
	getSubServers?: (tmdbId: number, season?: number, episode?: number) => Promise<SubServer[]>;
}

export interface ServerResult {
	sources: MediaSource[];
	subtitles: ProviderSubtitle[];
}

// Server configuration functions
function createFemboxConfig(): ServerConfig {
	return {
		id: 'fembox',
		name: 'Fembox',
		enabled: true,
		order: 4,
		fetchSources: async (tmdbId: number, season?: number, episode?: number, subServerName?: string) =>
			withProtection(async () => {
				if (subServerName === 'HLS') {
					const result = await fetchFemboxHlsSources(tmdbId, season, episode);
					return result.sources;
				}
				if (subServerName === 'MP4') {
					const result = await fetchFemboxSources(tmdbId, season, episode);
					return result.sources;
				}
				const mp4Result = await fetchFemboxSources(tmdbId, season, episode);
				if (mp4Result.sources.length > 0) return mp4Result.sources;
				const hlsResult = await fetchFemboxHlsSources(tmdbId, season, episode);
				return hlsResult.sources;
			}, []),
		getSubtitles: async (tmdbId: number, season?: number, episode?: number, subServerName?: string) =>
			withProtection(async () => {
				if (subServerName === 'HLS') {
					const result = await fetchFemboxHlsSources(tmdbId, season, episode);
					return result.subtitles;
				}
				if (subServerName === 'MP4') {
					const result = await fetchFemboxSources(tmdbId, season, episode);
					return result.subtitles;
				}
				const mp4Result = await fetchFemboxSources(tmdbId, season, episode);
				if (mp4Result.subtitles.length > 0 || mp4Result.sources.length > 0) return mp4Result.subtitles;
				const hlsResult = await fetchFemboxHlsSources(tmdbId, season, episode);
				return hlsResult.subtitles;
			}, []),
		getSubServers: (tmdbId, season, episode) =>
			withProtection(() => getFemboxSubServers(tmdbId, season, episode), [])
	};
}

function createIcefyConfig(): ServerConfig {
	return {
		id: 'icefy',
		name: 'Snowly',
		enabled: true,
		order: 2,
		useProxy: true, // Requires proxy for CORS
		fetchSources: (tmdbId, season, episode) =>
			withProtection(() => fetchIcefySources(tmdbId, getMediaType(season, episode), season, episode), [])
	};
}

function createVixsrcConfig(): ServerConfig {
	return {
		id: 'vixsrc',
		name: 'Redwood',
		enabled: true,
		order: 1,
		extensionRequired: true,
		fetchSources: (tmdbId, season, episode) =>
			withProtection(() => fetchVixsrcSources(tmdbId, getMediaType(season, episode), season, episode), [])
	};
}

function createVideasyConfig(): ServerConfig {
	return {
		id: 'videasy',
		name: 'Granite',
		enabled: true,
		order: 3,
		extensionRequired: true,
		fetchSources: (tmdbId, season, episode) =>
			withProtection(() => fetchVideasySources(tmdbId, season, episode), [])
	};
}

function createShowboxConfig(): ServerConfig {
	return {
		id: 'showbox',
		name: 'Showbox',
		enabled: true,
		order: 5,
		fetchSources: (tmdbId, season, episode) =>
			withProtection(() => showbox.fetchSources(tmdbId.toString(), season?.toString(), episode?.toString()), [])
	};
}

function createPasmellsConfig(): ServerConfig {
	return {
		id: 'pasmells',
		name: 'Pasmells 🤝',
		enabled: true,
		order: 0,
		useProxy: false,
		fetchSources: (tmdbId, season, episode, subServerName) =>
			withProtection(() => fetchPasmellsSources(tmdbId, getMediaType(season, episode), season, episode, subServerName), []),
		getSubServers: (tmdbId, season, episode) =>
			withProtection(() => getPasmellsSubServers(tmdbId, season, episode), [])
	};
}

// Base server configurations
export const baseServerConfigs: ServerConfig[] = [
	createPasmellsConfig(),
	createVixsrcConfig(),
	createIcefyConfig(),
	createVideasyConfig(),
	createFemboxConfig(),
	createShowboxConfig()
];

// Runtime configuration helpers
function isBrowserEnvironment(): boolean {
	return typeof window !== 'undefined';
}

function shouldShowFembox(): boolean {
	return isBrowserEnvironment() && !!getFemboxToken();
}

function getDefaultServerConfigs(): ServerConfig[] {
	return baseServerConfigs
		.filter(server => server.enabled)
		.sort((a, b) => a.order - b.order);
}

function applySavedOrder(baseConfigs: ServerConfig[]): ServerConfig[] {
	if (!isBrowserEnvironment()) {
		return baseConfigs;
	}

	const savedOrder = getServerOrder();
	if (!savedOrder) {
		return baseConfigs;
	}

	const serverMap = new Map(baseConfigs.map(s => [s.id, { ...s }]));
	const savedIds = new Set(savedOrder.map(s => s.id));
	const orderedServers: ServerConfig[] = [];

	// Add saved servers in order
	savedOrder.forEach(saved => {
		const server = serverMap.get(saved.id);
		if (server) {
			server.order = saved.order;
			server.enabled = saved.enabled;
			orderedServers.push(server);
		}
	});

	// Add any new servers that weren't in saved order
	baseConfigs.forEach(server => {
		if (!savedIds.has(server.id)) {
			orderedServers.push({ ...server });
		}
	});

	return orderedServers;
}

function filterEnabledServers(servers: ServerConfig[]): ServerConfig[] {
	return servers
		.filter(server => {
			if (server.disabled || !server.enabled) return false;
			// Hide Fembox if no token
			if (server.id === 'fembox' && !shouldShowFembox()) {
				return false;
			}
			return true;
		})
		.sort((a, b) => a.order - b.order);
}

// Get server configs with saved order/enabled state from localStorage
function getServerConfigs(): ServerConfig[] {
	if (!isBrowserEnvironment()) {
		return getDefaultServerConfigs();
	}

	const orderedServers = applySavedOrder(baseServerConfigs);
	return filterEnabledServers(orderedServers);
}

// Function to get fresh server configs (recalculates token check)
export function getFreshServerConfigs(): ServerConfig[] {
	return getServerConfigs();
}

// Export the function result (will be recalculated on each import in browser)
export const serverConfigs = getServerConfigs();
