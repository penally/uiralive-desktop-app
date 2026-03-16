/**
 * Pasmells server - sources from pasmells.uira.live via backend proxy.
 * Backend handles BalooPow validation and bypass header.
 */

import type { MediaSource, ProviderSubtitle } from '../lib/types';
import {
  waitForBalooPayload,
  clearBalooCache,
} from './pasmells/balooPow';

const SERVER_LIST = [
  { altName: 'rift', name: 'Rift' },
  { altName: 'mav', name: 'Mav' },
  { altName: 'pas', name: 'Pas' },
  { altName: 'ak47', name: 'Ak47' },
  { altName: 'echo', name: 'Echo' },
  { altName: 'bravo', name: 'Bravo' },
];

interface UiraScraper {
  altName: string | null;
  status: 'online' | 'offline';
  isMultiserver: boolean;
  servers: string[];
}

function getApiBase(): string {
  // In dev, return '' so requests go through the Vite proxy (which strips /api).
  // In production, use the absolute backend URL.
  if (import.meta.env?.DEV) return '';
  return (import.meta.env?.VITE_API_BASE_URL as string) || '';
}

let scrapersCache: { altName: string; name: string }[] | null = null;

async function getScrapers(): Promise<{ altName: string; name: string }[]> {
  if (scrapersCache) {
    console.log('[Pasmells] getScrapers: from cache');
    return scrapersCache;
  }
  try {
    const base = getApiBase();
    console.log('[Pasmells] getScrapers: fetching');
    const res = await fetch(`${base}/api/pasmells/scrapers`);
    if (!res.ok) return SERVER_LIST;
    const data = (await res.json()) as { scrapers?: UiraScraper[] };
    const list = data.scrapers || [];
    const BLOCKED_SCRAPERS = ['golf'];
    const online = list.filter(
      (s) => s.status === 'online' && s.altName && !BLOCKED_SCRAPERS.includes(s.altName.toLowerCase())
    );
    scrapersCache = online.map((s) => ({
      altName: s.altName!,
      name: s.altName!.charAt(0).toUpperCase() + s.altName!.slice(1),
    }));
    if (scrapersCache.length === 0) scrapersCache = SERVER_LIST;
    console.log('[Pasmells] getScrapers: done', { count: scrapersCache.length });
    return scrapersCache;
  } catch (e) {
    console.log('[Pasmells] getScrapers: failed, using server list', e);
    return SERVER_LIST;
  }
}

function b64UrlEncode(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function ensureBalooPayload(): Promise<{ solution: string; encryptedData: string; encryptedChecksum: string }> {
  console.log('[Pasmells] ensureBalooPayload: start');
  const payload = await waitForBalooPayload(20000);
  console.log('[Pasmells] ensureBalooPayload: done');
  return payload;
}

export async function fetchPasmellsSources(
  tmdbId: number,
  mediaType: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number,
  subServerName?: string
): Promise<MediaSource[]> {
  console.log('[Pasmells] fetchPasmellsSources: start', { tmdbId, mediaType, season, episode, subServerName });
  const base = getApiBase();
  // Trigger PoW solve + backend verify (sets PoW cookie for 2 h).
  // Result is not embedded in the URL; the cookie is sent automatically.
  await ensureBalooPayload();

  const scrapers = await getScrapers();
  const scraperName = subServerName
    ? scrapers.find((s) => s.name.toLowerCase().includes(subServerName.toLowerCase()))?.altName ?? scrapers[0]?.altName
    : scrapers[0]?.altName;
  if (!scraperName) throw new Error('No scrapers available');

  const seg1 = b64UrlEncode({ type: mediaType, tmdbId });
  const seg2 = mediaType === 'tv' ? b64UrlEncode({ season: season ?? 0, episode: episode ?? 0 }) : b64UrlEncode({});
  const seg3 = b64UrlEncode({ scraperName, server: '' });

  const url = `${base}/api/server/${seg1}/${seg2}/${seg3}`;
  console.log('[Pasmells] fetchPasmellsSources: fetching', { url: url.slice(0, 80) + '...' });

  try {
    const res = await fetch(url, { credentials: 'include' });
    console.log('[Pasmells] fetchPasmellsSources: response', { status: res.status });
    const data = (await res.json()) as {
      sources?: Array<{ file: string; quality: string; type: string; headers?: Record<string, string> }>;
      subtitles?: ProviderSubtitle[];
      error?: string;
    };

    if (data.error === 'Verification failed') {
      console.log('[Pasmells] fetchPasmellsSources: verification failed');
      clearBalooCache();
      throw new Error('Verification expired. Please refresh and try again.');
    }
    if (data.error) {
      console.log('[Pasmells] fetchPasmellsSources: error', data.error);
      throw new Error(data.error);
    }
    if (!data.sources?.length) {
      console.log('[Pasmells] fetchPasmellsSources: no sources');
      return [];
    }
    console.log('[Pasmells] fetchPasmellsSources: success', { sourcesCount: data.sources.length });

    const m3u8 = data.sources.filter((s) => s.type === 'm3u8' || s.type === 'hls');
    const mp4 = data.sources.filter((s) => s.type === 'mp4');

    const sources: MediaSource[] = [];

    if (m3u8.length > 0) {
      const best = m3u8.sort((a, b) => {
        const q = (s: string) => {
          if (/4k|2160/i.test(s)) return 2160;
          if (/1080/i.test(s)) return 1080;
          if (/720/i.test(s)) return 720;
          return 0;
        };
        return q(b.quality) - q(a.quality);
      })[0];
      sources.push({
        url: best.file,
        quality: best.quality || 'Auto',
        name: 'Pasmells',
        speed: '—',
        size: '—',
        type: 'hls',
        headers: best.headers,
      });
    }

    mp4.forEach((s) => {
      sources.push({
        url: s.file,
        quality: s.quality || 'Auto',
        name: 'Pasmells',
        speed: '—',
        size: '—',
        type: 'video',
        headers: s.headers,
      });
    });

    return sources;
  } catch (e) {
    console.log('[Pasmells] fetchPasmellsSources: caught', e);
    if (e instanceof Error && e.message.includes('Verification')) {
      clearBalooCache();
    }
    throw e;
  }
}

export async function getPasmellsSubServers(
  _tmdbId: number,
  _season?: number,
  _episode?: number
): Promise<Array<{ id: string; name: string; sources: MediaSource[] }>> {
  const scrapers = await getScrapers();
  return scrapers.map((s) => ({
    id: `pasmells-${s.altName}`,
    name: s.name,
    sources: [{ url: 'about:blank', quality: 'Auto', name: s.name, speed: '—', size: '—', type: 'hls' }],
  }));
}
