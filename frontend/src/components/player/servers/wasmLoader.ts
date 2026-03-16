/**
 * Lazy loader for servers WASM module. Server decrypts - no keys in client.
 */

import { buildLeasePath } from './leasePath';
import { envAt } from './_env';

export type ServersWasm = {
  buildIcefyUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  parseIcefyResponse: (url: string, text: string) => string;
  buildVixsrcPageUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildVixsrcPlaylistUrl: (videoId: string, token: string, expires: string) => string;
  parseVixsrcScript: (scriptContent: string) => string;
  isAllowedOrigin: (origin: string) => boolean;
  buildVidfastMediaUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildVidfastEncDecUrl: (rawData: string) => string;
  extractVidfastRawData: (pageHtml: string) => string;
  parseVidfastEncDecResponse: (jsonStr: string) => string;
  buildVideasySourcesUrl: (title: string, mediaType: string, year: string, tmdbId: number, season: number, episode: number) => string;
  buildVideasyDecryptUrl: () => string;
  buildVidlinkEncUrl: (tmdbId: number) => string;
  buildVidlinkApiUrl: (encryptedId: string, mediaType: string, season: number, episode: number) => string;
  extractQualityFromStream: (streamData: string) => string;
  buildVidnestMovieUrl: (backendId: string, tmdbId: number) => string;
  buildVidnestTvUrl: (backendId: string, tmdbId: number, season: number, episode: number) => string;
  buildProxyDestinationUrl: (destination: string) => string;
  buildMovieBayProxyUrl: (url: string, headersJson: string) => string;
  buildFemboxMovieUrl: (tmdbId: number, token: string) => string;
  buildFemboxTvUrl: (tmdbId: number, season: number, episode: number, token: string, region: string) => string;
  buildFemboxHlsUrl: (tmdbId: number, mediaType: string, season: number, episode: number, token: string, region: string) => string;
  buildBcineApiUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildBcineProxyUrl: (destination: string, referer: string, headersJson: string) => string;
  decryptBcineUrl: (encryptedUrl: string) => string;
  buildAuroraApiUrl: (name: string, year: string, tmdbId: number, mediaType: string, season: number, episode: number, cacheBuster: string) => string;
  buildAuroraM3u8ProxyUrl: (url: string) => string;
  buildDougoilEmbedUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildDougoilProxyUrl: (targetUrl: string) => string;
  buildDougoilM3u8ProxyUrl: (url: string) => string;
  buildAmriApiUrl: (tmdbId: number, season: number, episode: number) => string;
  buildXPassApiUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildYFlixFindUrl: (tmdbId: number, mediaType: string) => string;
  buildYFlixEncUrl: (text: string) => string;
  buildYFlixDecUrl: () => string;
  buildYFlixLinksUrl: (eid: string, encId: string) => string;
  buildYFlixViewUrl: (lid: string, encLid: string) => string;
  buildYFlixMediaUrl: (embedUrl: string) => string;
  buildMovieBoxInitUrl: () => string;
  buildMovieBoxSearchUrl: () => string;
  buildMovieBoxDetailUrl: (subjectId: string) => string;
  buildMovieBoxDownloadUrl: (subjectId: string, mediaType: string, season: number, episode: number) => string;
  buildHexaApiUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildHexaDecUrl: () => string;
  buildSmashyStreamTokenUrl: () => string;
  buildSmashyStreamPlayerUrl: (imdbId: string, tmdbId: number, mediaType: string, season: number, episode: number, token: string, userId: string) => string;
  buildSmashyStreamVideoUrl: (host: string, id: string) => string;
  buildSmashyStreamDecUrl: () => string;
  buildShowboxShareUrl: (movieId: string, type: string) => string;
  buildShowboxSearchUrl: (keyword: string) => string;
  buildShowboxMovieDetailUrl: (movieUrl: string) => string;
  buildShowboxFileShareInfoUrl: (shareKey: string) => string;
  buildShowboxFileShareListUrl: (shareKey: string, parentId: string) => string;
  buildShowboxProxyBase: () => string;
  buildVxrMovieUrl: (id: string) => string;
  buildVxrM3u8ProxyUrl: (url: string) => string;
  extractVxrOriginalUrl: (proxyUrl: string) => string;
  buildMadPlayCdnUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
  buildMadPlayApiUrl: (tmdbId: number, mediaType: string, season: number, episode: number) => string;
};

let wasmModule: ServersWasm | null = null;

let loadPromise: Promise<ServersWasm | null> | null = null;

async function fetchLeasePlain(seg1B64: string, seg2B64: string): Promise<string> {
  const { path, ts } = buildLeasePath(seg1B64, seg2B64);
  const [{ getProofB64 }, { computeProofHeader }, { decryptLeaseResponse }] = await Promise.all([
    import('./lease/proofSecret'),
    import('./lease/proofHeader'),
    import('./lease/decryptResponse'),
  ]);
  const proofB64 = getProofB64();
  if (!proofB64) throw new Error('Lease proof not configured');
  const proofHeader = await computeProofHeader(ts, proofB64);
  const apiBase = import.meta.env?.DEV ? '' : ((import.meta.env?.VITE_API_BASE_URL as string) || '');
  // path already starts with /api (from buildLeasePath) — keep it so the Vite proxy and nginx both route correctly
  const leaseUrl = apiBase ? `${apiBase.replace(/\/$/, '')}${path}` : path;
  const token = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
  const headers: Record<string, string> = { [String.fromCharCode(88, 45, 76, 101, 97, 115, 101, 45, 80, 114, 111, 111, 102)]: proofHeader };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(leaseUrl, { headers });
  if (!res.ok) throw new Error(`Lease failed: ${res.status}`);
  const body = (await res.json()) as { url?: string; expiresAt?: number; enc?: string };
  let url: string;
  if (body.enc) {
    const dec = await decryptLeaseResponse(body.enc, ts, proofHeader);
    url = dec.url;
  } else if (body.url) {
    url = body.url;
  } else {
    throw new Error('Invalid lease response');
  }
  // url from backend is /api/wasm/<token> — prepend apiBase for production, leave as-is for dev proxy
  return apiBase ? `${apiBase.replace(/\/$/, '')}${url}` : url;
}

export async function loadServersWasm(): Promise<ServersWasm | null> {
  if (wasmModule) return wasmModule;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const seg1B64 = envAt(15);
    const seg2B64 = envAt(16);
    const useLease = !!seg1B64 && !!seg2B64;
    try {
      if (useLease) {
        const wasmUrl = await fetchLeasePlain(seg1B64, seg2B64);
        const leasedMod = await import(/* @vite-ignore */ new URL('../../../../servers-wasm/build/release-leased.js', import.meta.url).href);
        wasmModule = await leasedMod.loadLeasedWasm(wasmUrl);
        return wasmModule;
      }
      const plainMod = await import(/* @vite-ignore */ new URL('../../../../servers-wasm/build/release.js', import.meta.url).href);
      wasmModule = (plainMod?.default ?? plainMod) as ServersWasm;
      return wasmModule;
    } catch {
      return null;
    }
  })();
  return loadPromise;
}

export function getServersWasm(): ServersWasm | null {
  return wasmModule;
}
