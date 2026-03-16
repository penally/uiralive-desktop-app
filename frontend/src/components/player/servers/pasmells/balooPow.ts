/**
 * BalooPow integration - proof-of-work challenge.
 * Uses https://pow-api.bxv.gg/ via official scripts:
 * - balooPow.api.dark.min.js (UI flow)
 * - balooPow.wasm.min.js (WASM solver)
 * Challenge fetched via our proxy so backend validation uses the same challenge.
 */

import { getPasmellsTurnstileToken } from './turnstileToken';
import { collectBrowserFingerprint } from '@/lib/browserFingerprint';

const BALOO_IDENTIFIER = 'uira-pasmells';
const COOKIE_NAME = `bPow_${BALOO_IDENTIFIER}`;
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 min (challenge valid 5 min, buffer)
// Plain JS solver — uses importScripts + CryptoJS, universally compatible.
// The WASM version (balooPow.wasm.min.js) spawns type:'module' blob workers
// that silently hang when cross-origin ES module imports are blocked by CSP
// or browser sandbox restrictions.
const BALOOPOW_SOLVER_URL = 'https://cdn.jsdelivr.net/gh/41Baloo/balooPow@main/balooPow.min.js';

export interface BalooPayload {
  solution: string;
  encryptedData: string;       // publicKey from create (validate API needs it)
  encryptedChecksum: string;   // checksum from challenge
  publicSalt?: string;         // from challenge
  challenge?: string;          // from challenge
  sessionToken?: string;       // HMAC proof challenge was created via fp gate
}

let cachedPayload: { payload: BalooPayload; expiresAt: number } | null = null;

/**
 * Read BalooPow result from cookie (set by BalooPow script on completion).
 * Script stores { solution, checksum }. encryptedData must be publicKey (from create).
 */
export function getBalooPayloadFromCookie(publicKey?: string): BalooPayload | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  const match = cookies.find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  console.log('[BalooPow] getBalooPayloadFromCookie:', { hasMatch: !!match, publicKey });
  if (!match) return null;
  try {
    const pk = publicKey || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PUBLICKEY_STORAGE) : null);
    const value = decodeURIComponent(match.split('=')[1]?.trim() || '');
    const parsed = JSON.parse(value) as Record<string, string>;
    const solution = parsed?.solution || parsed?.s;
    const checksum = parsed?.checksum || parsed?.encryptedChecksum || parsed?.ec;
    const encryptedChecksum = checksum || '';
    const encryptedData = pk || parsed?.encryptedData || parsed?.ed || '';
    if (solution && encryptedChecksum && encryptedData) {
      console.log('[BalooPow] getBalooPayloadFromCookie: found payload');
      return { solution, encryptedData, encryptedChecksum };
    }
    console.log('[BalooPow] getBalooPayloadFromCookie: missing fields', { solution: !!solution, encryptedChecksum: !!encryptedChecksum, encryptedData: !!encryptedData });
  } catch (e) {
    console.log('[BalooPow] getBalooPayloadFromCookie: parse error', e);
  }
  return null;
}

/**
 * Get BalooPow payload - from cache or cookie
 */
export function getBalooPayload(): BalooPayload | null {
  if (cachedPayload && Date.now() < cachedPayload.expiresAt) {
    console.log('[BalooPow] getBalooPayload: from cache');
    return cachedPayload.payload;
  }
  const payload = getBalooPayloadFromCookie();
  if (payload) {
    cachedPayload = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    console.log('[BalooPow] getBalooPayload: from cookie');
    return payload;
  }
  console.log('[BalooPow] getBalooPayload: no payload');
  return null;
}

/**
 * Cache payload after BalooPow completion
 */
export function setBalooPayload(payload: BalooPayload): void {
  console.log('[BalooPow] setBalooPayload');
  cachedPayload = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
}

/**
 * Clear cached payload and cookie (e.g. when verification fails).
 * Must clear cookie so stale/invalid payload is not reused.
 */
export function clearBalooCache(): void {
  console.log('[BalooPow] clearBalooCache');
  cachedPayload = null;
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  }
}

/**
 * Full reset — clears cache, cookie AND the in-flight challenge promise so
 * the next call to waitForBalooPayload() runs a fresh solve.
 * Use this for manual retries (e.g. "Having issues?" on the login page).
 */
export function resetBalooPow(): void {
  console.log('[BalooPow] resetBalooPow');
  clearBalooCache();
  runChallengePromise = null;
}

const BALOOPOW_API = 'https://pow-api.bxv.gg';
const PUBLICKEY_STORAGE = 'baloo_publicKey';

function getPowApiBase(): string {
  // In dev, return '' so requests go through the Vite proxy (which strips /api).
  // In production, use the absolute backend URL.
  if (import.meta.env?.DEV) return '';
  return (import.meta.env?.VITE_API_BASE_URL as string) || '';
}

declare global {
  interface Window {
    BalooPow?: new (
      publicSalt: string,
      difficulty: number,
      challenge: string,
      numeric?: boolean
    ) => { Solve: () => Promise<{ solution: string } | null> };
  }
}

/** Load BalooPow plain-JS solver and return the BalooPow class */
let solverLoadPromise: Promise<NonNullable<typeof window.BalooPow>> | null = null;
export function loadBalooPowSolver(): Promise<NonNullable<typeof window.BalooPow>> {
  if (typeof window !== 'undefined' && window.BalooPow) {
    return Promise.resolve(window.BalooPow);
  }
  if (solverLoadPromise) return solverLoadPromise;
  solverLoadPromise = (async () => {
    try {
      const resp = await fetch(BALOOPOW_SOLVER_URL);
      if (!resp.ok) throw new Error(`Failed to fetch BalooPow solver: ${resp.status}`);
      const code = await resp.text();
      // Execute in an isolated scope via Function() so `class BalooPow` is never
      // declared in the global scope — avoids SyntaxError on StrictMode double-invoke
      // and avoids window pollution. Workers spawned inside still have access to
      // all browser globals since Function() shares the window environment.
      // eslint-disable-next-line no-new-func
      const factory = new Function(`${code}\nreturn typeof BalooPow !== 'undefined' ? BalooPow : null;`);
      const cls = factory() as typeof window.BalooPow | null;
      if (!cls) throw new Error('BalooPow class not found in solver script');
      window.BalooPow = cls; // cache so the early-return path works on subsequent calls
      return cls;
    } catch (e) {
      solverLoadPromise = null; // allow retry on next call
      throw e;
    }
  })();
  return solverLoadPromise;
}

let runChallengePromise: Promise<BalooPayload> | null = null;

/**
 * Run BalooPow challenge - fetch challenge, solve with WASM, set cookie.
 * Per docs: create -> fetch /api/pow/{publicKey} -> solve -> cookie { solution, checksum }
 * Single-flight: concurrent callers share the same promise.
 */
async function runBalooChallenge(): Promise<BalooPayload> {
  if (runChallengePromise) {
    console.log('[BalooPow] runBalooChallenge: reusing in-flight');
    return runChallengePromise;
  }
  console.log('[BalooPow] runBalooChallenge: start');
  runChallengePromise = (async () => {
    try {
      return await _runBalooChallenge();
    } finally {
      runChallengePromise = null;
    }
  })();
  return runChallengePromise;
}

async function _runBalooChallenge(): Promise<BalooPayload> {
  // ── Step 1: Obtain canvas challenge nonce + collect fingerprint ─────────────
  const base = getPowApiBase();
  let fpToken: string | undefined;
  try {
    // Get single-use server nonce before collecting the fingerprint.
    // The nonce is drawn on the canvas and folded into canvasNonceHash.
    const challengeRes = await fetch(`${base}/api/fp/challenge`);
    if (!challengeRes.ok) throw new Error(`fp/challenge: ${challengeRes.status}`);
    const { challengeToken, nonce } = (await challengeRes.json()) as { challengeToken?: string; nonce?: string };
    if (!challengeToken || !nonce) throw new Error('invalid fp/challenge response');

    const fp = await collectBrowserFingerprint(challengeToken, nonce);
    const fpRes = await fetch(`${base}/api/fp/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fp),
    });
    if (fpRes.ok) {
      const fpData = (await fpRes.json()) as { fpToken?: string };
      fpToken = fpData.fpToken;
      console.log('[BalooPow] fp registered, got fpToken');
    } else {
      console.warn('[BalooPow] fp/register failed:', fpRes.status);
    }
  } catch (e) {
    console.warn('[BalooPow] fp collection error (continuing):', e);
  }

  // ── Step 2: Create challenge (pass fpToken) ──────────────────────────────
  const { publicKey, sessionToken } = await createBalooChallenge(fpToken);
  console.log('[BalooPow] runBalooChallenge: create done', { publicKeyLen: publicKey?.length, hasSessionToken: !!sessionToken });
  try {
    sessionStorage.setItem(PUBLICKEY_STORAGE, publicKey);
  } catch {
    /* ignore */
  }

  // Fetch via our proxy so backend caches the same challenge for verification
  console.log('[BalooPow] runBalooChallenge: fetching challenge via proxy...');
  const powBase = getPowApiBase();
  const powUrl = powBase
    ? `${powBase}/api/pow/${encodeURIComponent(publicKey)}`
    : `${BALOOPOW_API}/api/pow/${encodeURIComponent(publicKey)}`;
  const powRes = await fetch(powUrl);
  console.log('[BalooPow] runBalooChallenge: pow response', { status: powRes.status });
  if (powRes.status !== 200) throw new Error(`BalooPow challenge failed: ${powRes.status}`);
  const powData = (await powRes.json()) as {
    publicSalt: string;
    difficulty: number;
    challenge: string;
    identifier: string;
    checksum: string;
    numeric?: boolean;
  };
  const { publicSalt, difficulty, challenge, identifier } = powData;
  console.log('[BalooPow] runBalooChallenge: challenge received', { publicSalt: publicSalt?.slice(0, 8), difficulty, identifier });

  // Use plain-JS BalooPow solver — retry up to 5 times since workers are probabilistic
  console.log('[BalooPow] runBalooChallenge: solving with official wasm...');
  const BalooPowClass = await loadBalooPowSolver();
  const numeric = powData.numeric !== false;
  let solution = '';
  let encryptedChecksum = '';
  for (let attempt = 1; attempt <= 5; attempt++) {
    const solver = new BalooPowClass(publicSalt, difficulty, challenge, numeric);
    let result: { solution: string; access?: string } | null = null;
    try {
      result = (await solver.Solve()) as { solution: string; access?: string };
    } catch {
      // AggregateError — all workers exhausted their ranges; try again with fresh workers
    }
    solution = result?.solution != null ? String(result.solution) : '';
    encryptedChecksum = result?.access || '';
    if (solution && encryptedChecksum) break;
    if (attempt < 5) console.warn(`[BalooPow] solve attempt ${attempt} failed, retrying…`);
  }
  // result.access = SHA256(solution + publicSalt) — this is exactly what the backend
  // verifies as encryptedChecksum. Use it directly; the API's `checksum` field is for
  // their own /api/pow/validate endpoint and has different semantics.
  console.log('[BalooPow] runBalooChallenge: solve done', { hasSolution: !!solution, hasAccess: !!encryptedChecksum });
  if (!solution) throw new Error('BalooPow solution not found');
  if (!encryptedChecksum) throw new Error('BalooPow access hash missing');

  const payload: BalooPayload = {
    solution,
    encryptedData: publicKey,
    encryptedChecksum,
    publicSalt,
    challenge,
    sessionToken,
  };
  const cookieVal = encodeURIComponent(JSON.stringify({ solution, checksum: encryptedChecksum }));
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `bPow_${identifier}=${cookieVal}; SameSite=Lax; path=/; max-age=7200${secure}`;
  setBalooPayload(payload);

  // Call backend /baloo/verify to issue the server-side PoW cookie (2 h).
  // This cookie is sent automatically on all subsequent /api/server/* requests.
  try {
    const turnstileToken = await getPasmellsTurnstileToken();
    const base = getPowApiBase();
    const verifyUrl = `${base}/api/baloo/verify`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ solution, encryptedData: publicKey, encryptedChecksum, publicSalt, challenge, turnstileToken, sessionToken }),
    });
    if (!verifyRes.ok) {
      console.warn('[BalooPow] /baloo/verify returned', verifyRes.status);
    } else {
      console.log('[BalooPow] PoW cookie issued by backend');
    }
  } catch (e) {
    console.warn('[BalooPow] /baloo/verify failed (will use URL-payload fallback):', e);
  }

  console.log('[BalooPow] runBalooChallenge: complete');
  return payload;
}

/**
 * Wait for BalooPow payload - from cache, cookie, or run challenge.
 */
export function waitForBalooPayload(_maxMs = 60000): Promise<BalooPayload> {
  console.log('[BalooPow] waitForBalooPayload: start');
  const payload = getBalooPayload();
  if (payload) {
    console.log('[BalooPow] waitForBalooPayload: using cached/cookie payload');
    return Promise.resolve(payload);
  }
  console.log('[BalooPow] waitForBalooPayload: running challenge');
  return runBalooChallenge().catch((e) => {
    console.log('[BalooPow] waitForBalooPayload: challenge failed', e);
    throw e;
  });
}

/**
 * Create BalooPow challenge - uses backend proxy when available, else pow-api directly.
 */
export async function createBalooChallenge(fpToken?: string): Promise<{ publicKey: string; identifier: string; sessionToken?: string }> {
  console.log('[BalooPow] createBalooChallenge: fetching...');
  const base = getPowApiBase();
  const createUrl = base ? `${base}/api/baloo/create` : `${BALOOPOW_API}/api/create`;
  const body = base
    ? JSON.stringify(fpToken ? { fpToken } : {})
    : JSON.stringify({
        difficulty: 5000000,
        secretKey: '',
        length: 8,
        identifier: BALOO_IDENTIFIER,
        timeValid: 300,
      });
  const res = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  console.log('[BalooPow] createBalooChallenge: response', { status: res.status });
  if (!res.ok) throw new Error('BalooPow create failed');
  const text = await res.text();
  let publicKey: string | undefined;
  let sessionToken: string | undefined;
  try {
    const data = JSON.parse(text) as { publicKey?: string; sessionToken?: string } | string;
    if (typeof data === 'string') {
      publicKey = data?.trim();
    } else {
      publicKey = data?.publicKey?.trim();
      sessionToken = data?.sessionToken;
    }
  } catch {
    publicKey = text?.trim();
  }
  if (!publicKey || publicKey.length < 10) throw new Error('BalooPow create failed');
  console.log('[BalooPow] createBalooChallenge: done', { publicKeyLen: publicKey.length, hasSessionToken: !!sessionToken });
  return { publicKey, identifier: BALOO_IDENTIFIER, sessionToken };
}

/**
 * Encode payload for opaque URL segment (base64url JSON)
 */
export function encodeBalooKey(payload: BalooPayload): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
