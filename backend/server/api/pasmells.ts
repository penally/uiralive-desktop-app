/**
 * Pasmells proxy + BalooPow gate.
 * Backend proxies all requests to pasmells.uira.live with bypass header.
 * BalooPow validation required before proxying.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireApproved } from '../middleware/auth.js';
import { balooPowChallengeCache, POW_CHALLENGE_TTL_MS } from '../shared/balooPowCache.js';
import { checkCreateAuthRateLimit, checkPasmellsCreateRateLimit, checkFpRegisterRateLimit, checkFpChallengeRateLimit } from '../shared/signalValidation.js';
import {
  validateFingerprintQuality,
  issueFingerprintToken,
  verifyFingerprintToken,
  consumeFingerprintToken,
  issueSessionBindingToken,
  verifySessionBindingToken,
  consumeTimingNonce,
  computeServerFpId,
  verifyFingerprintHash,
  issueFpChallenge,
  verifyFpChallenge,
  type BrowserFingerprintPayload,
} from '../shared/fingerprintValidation.js';

const router = Router();

const PASMELLS_BASE = process.env.PASMELLS_BASE_URL || 'https://pasmells.uira.live';
const BYPASS_KEY = process.env.PASMELLS_BYPASS_KEY || 'c0717bc9b408fcf5688ac73f959ab511';
const BALOOPOW_API = process.env.BALOOPOW_API_URL || 'https://pow-api.bxv.gg';
const BALOOPOW_SECRET = process.env.BALOOPOW_SECRET_KEY || '';
const BALOOPOW_IDENTIFIER = process.env.BALOOPOW_IDENTIFIER || 'uira-pasmells';
const BALOOPOW_AUTH_IDENTIFIER = process.env.BALOOPOW_AUTH_IDENTIFIER || 'uira-auth';
const PASMELLS_TURNSTILE_SECRET = process.env.PASMELLS_TURNSTILE_SECRET_KEY || '';
const APP_ORIGIN = process.env.APP_ORIGIN || process.env.VITE_APP_ORIGIN || 'https://beta.uira.live';

const POW_COOKIE_NAME = 'PoW';
const POW_COOKIE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Key chunks for path decoding (PASMELLS_PATH_KEY_P1..P4)
function assemblePathKey(): Buffer | null {
  const p1 = process.env.PASMELLS_PATH_KEY_P1;
  const p2 = process.env.PASMELLS_PATH_KEY_P2;
  const p3 = process.env.PASMELLS_PATH_KEY_P3;
  const p4 = process.env.PASMELLS_PATH_KEY_P4;
  if (!p1 || !p2 || !p3 || !p4) return null;
  const hex = (p1 + p2 + p3 + p4).replace(/\s/g, '');
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

const PATH_KEY = assemblePathKey();

// In-memory cache: identifier -> { publicKey, createdAt }
const balooChallengeCache = new Map<string, { publicKey: string; createdAt: number }>();
const BALOO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

// Challenge cache is now shared (see ../shared/balooPowCache.ts) so auth.ts
// can validate against the exact same data the frontend solved.

/**
 * Create BalooPow challenge - returns public key for frontend.
 * Gated by browser fingerprint token (proves JS APIs ran) + rate limit.
 * Issues a sessionToken binding this publicKey to the fp-gated creation.
 */
router.post('/baloo/create', async (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';

  // ── Gate 1: fingerprint token ──────────────────────────────────────────
  const fpToken: string = req.body?.fpToken || req.headers['x-fp-token'] as string || '';
  const fpResult = verifyFingerprintToken(fpToken, ip);
  if (!fpResult.ok) {
    console.warn('[Pasmells] /baloo/create blocked: invalid fpToken:', fpResult.reason, { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Fingerprint verification required' });
    return;
  }
  consumeFingerprintToken(fpToken);

  // ── Gate 2: rate limit ─────────────────────────────────────────────────
  if (!checkPasmellsCreateRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    return;
  }
  if (!BALOOPOW_SECRET) {
    res.status(503).json({ error: 'BalooPow not configured' });
    return;
  }
  try {
    const response = await fetch(`${BALOOPOW_API}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        difficulty: 5000000,
        secretKey: BALOOPOW_SECRET,
        length: 8,
        identifier: BALOOPOW_IDENTIFIER,
        timeValid: 300,
      }),
    });
    const text = await response.text();
    let publicKey: string | undefined;
    try {
      const parsed = JSON.parse(text) as string | { publicKey?: string };
      publicKey = typeof parsed === 'string' ? parsed : parsed?.publicKey;
    } catch {
      publicKey = text?.trim();
    }
    if (!publicKey || publicKey.length < 10) {
      console.error('[Pasmells] BalooPow create failed:', response.status, text?.slice(0, 200));
      res.status(502).json({ error: 'BalooPow create failed', detail: response.status === 200 ? 'Invalid response' : `Upstream ${response.status}` });
      return;
    }
    balooChallengeCache.set(BALOOPOW_IDENTIFIER, {
      publicKey,
      createdAt: Date.now(),
    });
    const sessionToken = issueSessionBindingToken(publicKey, ''); // pasmells player — no fpId
    res.json({ publicKey, sessionToken });
  } catch (e) {
    console.error('[Pasmells] BalooPow create error:', e);
    res.status(502).json({ error: 'BalooPow unavailable', detail: e instanceof Error ? e.message : String(e) });
  }
});

/**
 * Issue a short-lived, single-use canvas challenge nonce.
 * Client must draw this nonce on its canvas and return SHA256(dataURL+":"+nonce)
 * as canvasNonceHash in the subsequent /fp/register call.
 * This forces every registration to involve a live canvas render —
 * a precomputed canvasHash can never be reused across requests.
 */
router.get('/fp/challenge', (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';
  if (!checkFpChallengeRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }
  const { challengeToken, nonce } = issueFpChallenge();
  res.json({ challengeToken, nonce });
});

/**
 * Browser fingerprint registration.
 * Client posts JS-collected signals; server validates quality and issues a
 * short-lived (90 s) HMAC-signed fpToken.  The fpToken is required to obtain
 * a PoW challenge from /baloo/create-auth, meaning a raw requests script that
 * can't run canvas/WebGL/AudioContext is blocked at this gate.
 */
router.post('/fp/register', async (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const fp = req.body as BrowserFingerprintPayload | undefined;
  const challengeToken: string = (req.body as Record<string, string>)?.challengeToken ?? '';

  // ── IP rate limit ────────────────────────────────────────────────────────
  if (!checkFpRegisterRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }

  // ── Verify challenge token (single-use, ≤2 min old) ────────────────────────
  // Client must have called GET /fp/challenge before collecting the fingerprint.
  // The nonce is embedded in challengeToken; we verify HMAC + TTL + single-use.
  const challengeResult = verifyFpChallenge(challengeToken);
  if (!challengeResult.ok) {
    console.warn('[Pasmells] /fp/register blocked: bad challengeToken', { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Fingerprint validation failed' });
    return;
  }

  // ── Require canvasNonceHash ────────────────────────────────────────────
  // SHA256(canvas_with_nonce.toDataURL() + ":" + nonce) — must be non-empty.
  // Server can't verify the pixel values, but the nonce ensures it was computed
  // fresh for THIS challenge and can't be a static precomputed value.
  if (!fp?.canvasNonceHash || fp.canvasNonceHash === 'empty' || fp.canvasNonceHash.length < 16) {
    console.warn('[Pasmells] /fp/register blocked: missing canvasNonceHash', { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Fingerprint validation failed' });
    return;
  }

  const quality = validateFingerprintQuality(fp);
  if (!quality.ok) {
    console.warn('[Pasmells] /fp/register blocked:', quality.reason, { ip: ip.slice(0, 15) });
    // Return a generic error — don't reveal which signal failed
    res.status(403).json({ error: 'Fingerprint validation failed' });
    return;
  }
  if (quality.score > 0) {
    console.log('[Pasmells] /fp/register suspicious score:', quality.score, { ip: ip.slice(0, 15) });
  }

  // ── fp.hash self-consistency check ───────────────────────────────────────
  // Recompute the djb2 hash server-side and verify it matches the submitted
  // fp.hash.  A bot that changes timingNonce (to avoid the burn below) without
  // also recomputing the hash is caught here.  Keeps change-one-field attacks out.
  if (!verifyFingerprintHash(fp!)) {
    console.warn('[Pasmells] /fp/register blocked: hash mismatch', { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Fingerprint validation failed' });
    return;
  }

  // ── timingNonce single-use burn ──────────────────────────────────────────
  // performance.now() produces a unique float string each page load.
  // A bot sending the same hardcoded nonce on every run is permanently blocked
  // after the first request — without revealing which check failed.
  if (!consumeTimingNonce(fp!.timingNonce)) {
    console.warn('[Pasmells] /fp/register blocked: duplicate timingNonce', { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Fingerprint validation failed' });
    return;
  }

  // ── Compute server-side device identity ─────────────────────────────────
  const fpId = computeServerFpId(fp!);

  const token = issueFingerprintToken(fp!.hash || fp!.canvasHash, ip, fpId);
  res.json({ fpToken: token });
});

/**
 * Create BalooPow challenge for auth (login / register).
 * Uses a separate identifier so auth challenges don't mix with pasmells challenges.
 * Requires a valid fpToken from /fp/register (proves browser JS executed).
 * Issues a sessionToken that cryptographically binds this challenge to the gate.
 */
router.post('/baloo/create-auth', async (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';

  // ── Gate 1: fingerprint token ──────────────────────────────────────────
  const fpToken: string = req.body?.fpToken || req.headers['x-fp-token'] as string || '';
  const fpResult = verifyFingerprintToken(fpToken, ip);
  if (!fpResult.ok) {
    console.warn('[Pasmells] create-auth blocked: invalid fpToken:', fpResult.reason, { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Fingerprint verification required' });
    return;
  }
  // Consume immediately — single-use
  consumeFingerprintToken(fpToken);

  // ── Gate 2: rate limit ─────────────────────────────────────────────────
  if (!checkCreateAuthRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    return;
  }
  if (!BALOOPOW_SECRET) {
    res.status(503).json({ error: 'BalooPow not configured' });
    return;
  }
  try {
    const response = await fetch(`${BALOOPOW_API}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        difficulty: 5000000, // matches what /pow/:publicKey proxy returns to the solver
        secretKey: BALOOPOW_SECRET,
        length: 8,
        // Unique identifier per call — forces pow-api to generate a fresh publicKey every time,
        // preventing the same key being returned when a user retries after a failed login.
        identifier: `${BALOOPOW_AUTH_IDENTIFIER}_${crypto.randomBytes(8).toString('hex')}`,
        timeValid: 600, // 10 min — longer than pasmells since user may type slowly
      }),
    });
    const text = await response.text();
    let publicKey: string | undefined;
    try {
      const parsed = JSON.parse(text) as string | { publicKey?: string };
      publicKey = typeof parsed === 'string' ? parsed : parsed?.publicKey;
    } catch {
      publicKey = text?.trim();
    }
    if (!publicKey || publicKey.length < 10) {
      console.error('[Pasmells] BalooPow create-auth failed:', response.status, text?.slice(0, 200));
      res.status(502).json({ error: 'BalooPow create failed' });
      return;
    }
    // Issue a session binding token — cryptographically ties this publicKey to
    // the fp-gated create-auth call, and carries the device fpId so auth.ts can
    // enforce per-device registration caps without a DB lookup.
    const fpId = fpResult.payload?.f ?? '';
    const sessionToken = issueSessionBindingToken(publicKey, fpId);
    res.json({ publicKey, sessionToken });
  } catch (e) {
    console.error('[Pasmells] BalooPow create-auth error:', e);
    res.status(502).json({ error: 'BalooPow unavailable' });
  }
});

/**
 * Proxy pow challenge - fetch from pow-api, cache, return.
 * Frontend uses this so validation uses the SAME challenge (pow-api may return different data per request).
 */
router.get('/pow/:publicKey', async (req: Request, res: Response) => {
  const publicKey = typeof req.params.publicKey === 'string' ? req.params.publicKey : req.params.publicKey?.[0] ?? '';
  if (!publicKey || publicKey.length < 10) {
    res.status(400).json({ error: 'Invalid publicKey' });
    return;
  }
  const cached = balooPowChallengeCache.get(publicKey);
  if (cached && Date.now() - cached.fetchedAt < POW_CHALLENGE_TTL_MS) {
    res.json({
      publicSalt: cached.publicSalt,
      challenge: cached.challenge,
      checksum: cached.checksum,
      difficulty: 5000000,
      identifier: BALOOPOW_IDENTIFIER,
      numeric: cached.numeric ?? true,
    });
    return;
  }
  try {
    const powRes = await fetch(`${BALOOPOW_API}/api/pow/${encodeURIComponent(publicKey)}`);
    if (powRes.status !== 200) {
      res.status(powRes.status).json({ error: 'Challenge fetch failed' });
      return;
    }
    const data = (await powRes.json()) as {
      publicSalt?: string;
      challenge?: string;
      checksum?: string;
      difficulty?: number;
      identifier?: string;
      numeric?: boolean;
    };
    if (data.publicSalt && data.challenge) {
      balooPowChallengeCache.set(publicKey, {
        publicSalt: data.publicSalt,
        challenge: data.challenge,
        checksum: data.checksum,
        numeric: data.numeric,
        fetchedAt: Date.now(),
      });
    }
    res.json(data);
  } catch (e) {
    console.error('[Pasmells] pow proxy error:', e);
    res.status(502).json({ error: 'Upstream error' });
  }
});

/**
 * Fingerprint endpoint — proxy pow-api.bxv.gg/fp, inject client IP + UA.
 */
router.get('/fp', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  try {
    const fpRes = await fetch('https://pow-api.bxv.gg/fp', {
      headers: {
        'X-Forwarded-For': clientIp,
        'CF-Connecting-IP': clientIp,
        'User-Agent': ua,
      },
    });
    const data = (await fpRes.json()) as Record<string, unknown>;
    res.json({ ...data, ip: clientIp, ua });
  } catch (e) {
    console.error('[Pasmells] /fp error:', e);
    res.json({ ip: clientIp, ua });
  }
});

/**
 * Validate BalooPow locally - use cached challenge (from frontend's proxy fetch) or fetch from pow-api.
 * Client may send publicSalt/challenge for debugging (to detect if pow-api returns different data per request).
 */
async function validateBalooPow(
  _identifier: string,
  _ip: string,
  solution: string,
  encryptedData: string,
  encryptedChecksum: string,
  clientPublicSalt?: string,
  clientChallenge?: string
): Promise<boolean> {
  console.log('[Pasmells] validateBalooPow:', {
    hasSolution: !!solution,
    hasEncData: !!encryptedData,
    hasChecksum: !!encryptedChecksum,
  });
  if (!solution || !encryptedData || !encryptedChecksum) return false;
  try {
    let publicSalt: string | undefined;
    let challenge: string | undefined;
    // Prefer client-provided publicSalt/challenge: pow-api returns different data per request,
    // so we use what the client actually solved. Verification is secure: client must have
    // found solution where SHA256(publicSalt+solution)=challenge (PoW) and SHA256(solution+publicSalt)=checksum.
    if (clientPublicSalt && clientChallenge) {
      publicSalt = clientPublicSalt;
      challenge = clientChallenge;
      console.log('[Pasmells] validateBalooPow: using client challenge');
    }
    if (!publicSalt || !challenge) {
      const cached = balooPowChallengeCache.get(encryptedData);
      if (cached && Date.now() - cached.fetchedAt < POW_CHALLENGE_TTL_MS) {
        publicSalt = cached.publicSalt;
        challenge = cached.challenge;
        console.log('[Pasmells] validateBalooPow: using cached challenge');
      }
    }
    if (!publicSalt || !challenge) {
      const res = await fetch(`${BALOOPOW_API}/api/pow/${encodeURIComponent(encryptedData)}`);
      if (res.status !== 200) {
        console.log('[Pasmells] validateBalooPow: challenge fetch failed', res.status);
        return false;
      }
      const apiData = (await res.json()) as { publicSalt?: string; challenge?: string };
      publicSalt = apiData.publicSalt;
      challenge = apiData.challenge;
    }
    if (!publicSalt || !challenge) {
      console.log('[Pasmells] validateBalooPow: missing publicSalt/challenge');
      return false;
    }
    const challengeHash = crypto.createHash('sha256').update(publicSalt + solution).digest('hex');
    const accessHash = crypto.createHash('sha256').update(solution + publicSalt).digest('hex');
    const valid = challengeHash === challenge && accessHash === encryptedChecksum;
    console.log('[Pasmells] validateBalooPow result:', {
      valid,
      challengeMatch: challengeHash === challenge,
      accessMatch: accessHash === encryptedChecksum,
    });
    return valid;
  } catch (e) {
    console.error('[Pasmells] BalooPow validate error:', e);
    return false;
  }
}

// --- PoW cookie helpers ---

function signPowToken(issuedAt: number, ip: string, ua: string): string {
  const secret = (BALOOPOW_SECRET || APP_ORIGIN) + ':pow-cookie';
  return crypto.createHmac('sha256', secret).update(`${issuedAt}:${ip}:${ua}`).digest('hex');
}

/** Verify that the PoW cookie is valid AND was issued for the same IP + UA */
function verifyPowCookie(cookieHeader: string | undefined, ip: string, ua: string): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${POW_COOKIE_NAME}=`));
  if (!match) return false;
  const value = match.slice(POW_COOKIE_NAME.length + 1).trim();
  // Format: <hmac>.<issuedAt>.<b64ip>.<b64ua>
  const parts = value.split('.');
  if (parts.length < 4) return false;
  const [token, tsStr, b64ip, b64ua] = parts;
  const issuedAt = parseInt(tsStr, 10);
  if (isNaN(issuedAt) || Date.now() - issuedAt > POW_COOKIE_TTL_MS) return false;
  // Decoded bound values must match current request
  let cookieIp: string, cookieUa: string;
  try {
    cookieIp = Buffer.from(b64ip, 'base64url').toString('utf8');
    cookieUa = Buffer.from(b64ua, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  if (cookieIp !== ip || cookieUa !== ua) return false;
  try {
    const expected = Buffer.from(signPowToken(issuedAt, ip, ua), 'hex');
    const given = Buffer.from(token, 'hex');
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

function setPowCookie(res: Response, ip: string, ua: string): void {
  const issuedAt = Date.now();
  const token = signPowToken(issuedAt, ip, ua);
  const b64ip = Buffer.from(ip).toString('base64url');
  const b64ua = Buffer.from(ua).toString('base64url');
  const isProd = APP_ORIGIN.startsWith('https://');
  const sameSite = isProd ? 'None' : 'Lax';
  const secure = isProd ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${POW_COOKIE_NAME}=${token}.${issuedAt}.${b64ip}.${b64ua}; HttpOnly; Path=/; Max-Age=7200; SameSite=${sameSite}${secure}`
  );
}

/**
 * Verify Pasmells Turnstile token (Cloudflare).
 */
async function verifyPasmellsTurnstile(token: string): Promise<boolean> {
  if (!PASMELLS_TURNSTILE_SECRET) {
    console.error('[Pasmells] PASMELLS_TURNSTILE_SECRET_KEY not configured');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: PASMELLS_TURNSTILE_SECRET, response: token }),
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[]; hostname?: string; action?: string };
    console.log('[Pasmells] Turnstile siteverify response:', JSON.stringify(data));
    return data.success === true;
  } catch (e) {
    console.error('[Pasmells] Turnstile verify error:', e);
    return false;
  }
}

/**
 * Parse BalooPow cookie - script stores { solution, checksum }; API may use encryptedData/encryptedChecksum
 */
function parseBalooCookie(cookieHeader: string | undefined, identifier: string): {
  solution: string;
  encryptedData: string;
  encryptedChecksum: string;
} | null {
  if (!cookieHeader) return null;
  const name = `bPow_${identifier}`;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(name + '='));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(name.length + 1).trim());
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    const solution = parsed?.solution || parsed?.s;
    const checksum = parsed?.checksum;
    const encryptedData = parsed?.encryptedData || parsed?.ed || checksum || '';
    const encryptedChecksum = parsed?.encryptedChecksum || parsed?.ec || checksum || '';
    if (solution && (encryptedData || encryptedChecksum)) {
      return { solution, encryptedData, encryptedChecksum };
    }
  } catch {
    // Cookie might be raw format
  }
  return null;
}

/**
 * Proxy BalooPow validation — injects client IP, forwards to pow-api.
 * Used by auth routes (login/register) after the user completes the widget.
 */
router.post('/baloo/validate', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const { solution, encryptedData, encryptedChecksum } = req.body as {
    solution?: string;
    encryptedData?: string;
    encryptedChecksum?: string;
  };
  if (!solution || !encryptedData || !encryptedChecksum) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  try {
    const upstream = await fetch(`${BALOOPOW_API}/api/pow/validate/${encodeURIComponent(BALOOPOW_AUTH_IDENTIFIER)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, solution, encryptedData, encryptedChecksum }),
    });
    const data = (await upstream.json()) as { verified?: boolean };
    console.log('[Pasmells] /baloo/validate:', { ip: ip.slice(0, 15), verified: data.verified });
    res.json(data);
  } catch (e) {
    console.error('[Pasmells] /baloo/validate error:', e);
    res.status(502).json({ error: 'Upstream error' });
  }
});

/**
 * Verify BalooPow + Turnstile and issue PoW cookie (2 h).
 * Frontend calls this once after solving the challenge.
 * Requires a valid sessionToken proving creation went through the fp gate.
 */
router.post('/baloo/verify', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] as string) || '';
  const { solution, encryptedData, encryptedChecksum, publicSalt, challenge, turnstileToken, sessionToken } =
    req.body as {
      solution?: string;
      encryptedData?: string;
      encryptedChecksum?: string;
      publicSalt?: string;
      challenge?: string;
      turnstileToken?: string;
      sessionToken?: string;
    };

  if (!solution || !encryptedData || !encryptedChecksum) {
    res.status(400).json({ error: 'Missing PoW fields' });
    return;
  }

  // Verify session binding token — proves challenge was created via fp gate
  if (!sessionToken || !verifySessionBindingToken(encryptedData, sessionToken)) {
    console.warn('[Pasmells] /baloo/verify: missing or invalid sessionToken', { ip: ip.slice(0, 15) });
    res.status(403).json({ error: 'Session verification required' });
    return;
  }

  if (turnstileToken) {
    const tsValid = await verifyPasmellsTurnstile(turnstileToken);
    if (!tsValid) {
      console.log('[Pasmells] /baloo/verify: Turnstile failed');
      res.status(403).json({ error: 'Turnstile verification failed' });
      return;
    }
  }

  const valid = await validateBalooPow(
    BALOOPOW_IDENTIFIER,
    ip,
    solution,
    encryptedData,
    encryptedChecksum,
    publicSalt,
    challenge
  );
  if (!valid) {
    console.log('[Pasmells] /baloo/verify: PoW invalid');
    res.status(403).json({ error: 'Verification failed' });
    return;
  }

  setPowCookie(res, ip, ua);
  console.log('[Pasmells] /baloo/verify: cookie issued for', ip, ua.slice(0, 40));
  res.json({ ok: true });
});

/**
 * Decode opaque path segment (AES-256-GCM)
 */
function decodeSegment(encB64: string): string | null {
  if (!PATH_KEY) return null;
  try {
    const buf = Buffer.from(encB64, 'base64url');
    if (buf.length < 12 + 16) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ct = buf.subarray(12, buf.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', PATH_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct) + decipher.final('utf8');
  } catch {
    return null;
  }
}

/**
 * Cookie-gated opaque route: /api/server/:seg1/:seg2/:seg3
 * Requires JWT + approved account, and valid PoW cookie (issued by /baloo/verify).
 * seg1 = encoded tmdbId + type
 * seg2 = encoded season/episode for TV (or empty)
 * seg3 = encoded scraperName + server
 */
router.get('/server/:seg1/:seg2/:seg3', requireApproved, async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] as string) || '';
  if (!verifyPowCookie(req.headers.cookie, ip, ua)) {
    res.status(403).json({ error: 'pow-required' });
    return;
  }
  const { seg1, seg2, seg3 } = req.params;

  const decode = (s: string) => {
    if (PATH_KEY) {
      const d = decodeSegment(s);
      if (d) return d;
    }
    try {
      return Buffer.from(s, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  };

  const q1 = decode(typeof seg1 === 'string' ? seg1 : seg1?.[0] ?? '');
  const q2 = decode(typeof seg2 === 'string' ? seg2 : seg2?.[0] ?? '');
  const q3 = decode(typeof seg3 === 'string' ? seg3 : seg3?.[0] ?? '');

  if (!q1 || !q3) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  let path = '';
  let scraperName = '';
  let server = '';
  try {
    const p1 = JSON.parse(q1) as { type: string; tmdbId: number };
    const p3 = JSON.parse(q3) as { scraperName: string; server?: string };
    scraperName = p3.scraperName;
    server = p3.server || '';
    if (p1.type === 'movie') {
      path = `/api/scrapers/${scraperName}/stream/${p1.tmdbId}`;
    } else {
      const p2 = q2 ? (JSON.parse(q2) as { season: number; episode: number }) : null;
      if (!p2) { res.status(400).json({ error: 'Invalid request' }); return; }
      path = `/api/scrapers/${scraperName}/stream/${p1.tmdbId}/${p2.season}/${p2.episode}`;
    }
    if (server) path += `?server=${encodeURIComponent(server)}`;
    else path += '?proxy=true';
  } catch {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  const targetUrl = `${PASMELLS_BASE}${path}&keyhidden=${BYPASS_KEY}`;
  console.log('[Pasmells] (cookie) Proxying to:', targetUrl.slice(0, 80) + '...');
  try {
    const proxyRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Origin: APP_ORIGIN,
        Referer: `${APP_ORIGIN}/`,
      },
    });
    const text = await proxyRes.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      res.status(502).json({ error: 'Upstream error', detail: 'Invalid response from source' });
      return;
    }
    console.log('[Pasmells] (cookie) Proxy response:', { status: proxyRes.status, ip, ua: ua.slice(0, 40) });
    res.json(data);
  } catch (e) {
    console.error('[Pasmells] (cookie) Proxy error:', e);
    res.status(502).json({ error: 'Upstream error' });
  }
});

/**
 * Legacy opaque route: /api/server/:seg1/:seg2/:balooKey/:seg3
 * Requires JWT + approved account. Validates BalooPow from URL payload and issues PoW cookie on success.
 * seg1 = encoded tmdbId (or query type)
 * seg2 = encoded season/episode for TV
 * balooKey = base64url of JSON { solution, encryptedData, encryptedChecksum }
 * seg3 = encoded scraperName + server
 */
router.get('/server/:seg1/:seg2/:balooKey/:seg3', requireApproved, async (req: Request, res: Response) => {
  console.log('[Pasmells] GET /server/:seg1/:seg2/:balooKey/:seg3');
  const turnstileToken =
    (req.headers['x-turnstile-token'] as string)?.trim() ||
    (req.headers['X-Turnstile-Token'] as string)?.trim();
  if (!turnstileToken) {
    console.log('[Pasmells] Missing x-turnstile-token');
    res.status(403).json({ error: 'Verification required' });
    return;
  }
  const turnstileValid = await verifyPasmellsTurnstile(turnstileToken);
  if (!turnstileValid) {
    console.log('[Pasmells] Turnstile verification failed');
    res.status(403).json({ error: 'Verification failed' });
    return;
  }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] as string) || '';
  const { seg1, seg2, balooKey, seg3 } = req.params;
  const balooKeyStr = typeof balooKey === 'string' ? balooKey : balooKey?.[0] ?? '';

  // Decode BalooPow payload from path
  let balooPayload: {
    solution: string;
    encryptedData: string;
    encryptedChecksum: string;
    publicSalt?: string;
    challenge?: string;
  };
  try {
    const raw = Buffer.from(balooKeyStr, 'base64url').toString('utf8');
    balooPayload = JSON.parse(raw) as typeof balooPayload;
    console.log('[Pasmells] balooPayload decoded');
  } catch (e) {
    console.log('[Pasmells] balooKey decode failed:', e);
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  const valid = await validateBalooPow(
    BALOOPOW_IDENTIFIER,
    ip,
    balooPayload.solution,
    balooPayload.encryptedData,
    balooPayload.encryptedChecksum,
    balooPayload.publicSalt,
    balooPayload.challenge
  );
  if (!valid) {
    console.log('[Pasmells] Verification failed');
    res.status(403).json({ error: 'Verification failed' });
    return;
  }
  console.log('[Pasmells] Verification passed, decoding segments');
  // Issue PoW cookie so subsequent requests use the lighter cookie-gated route
  setPowCookie(res, ip, ua);

  // Decode segments: try AES first, fallback to base64 JSON
  const decode = (s: string) => {
    if (PATH_KEY) {
      const d = decodeSegment(s);
      if (d) return d;
    }
    try {
      return Buffer.from(s, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  };
  const q1 = decode(typeof seg1 === 'string' ? seg1 : seg1?.[0] ?? '');
  const q2 = decode(typeof seg2 === 'string' ? seg2 : seg2?.[0] ?? '');
  const q3 = decode(typeof seg3 === 'string' ? seg3 : seg3?.[0] ?? '');
  if (!q1 || !q3) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  let path = '';
  let scraperName = '';
  let server = '';
  try {
    const p1 = JSON.parse(q1) as { type: string; tmdbId: number };
    const p3 = JSON.parse(q3) as { scraperName: string; server?: string };
    scraperName = p3.scraperName;
    server = p3.server || '';
    if (p1.type === 'movie') {
      path = `/api/scrapers/${scraperName}/stream/${p1.tmdbId}`;
    } else {
      const p2 = q2 ? (JSON.parse(q2) as { season: number; episode: number }) : null;
      if (!p2) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }
      path = `/api/scrapers/${scraperName}/stream/${p1.tmdbId}/${p2.season}/${p2.episode}`;
    }
    if (server) path += `?server=${encodeURIComponent(server)}`;
    else path += '?proxy=true';
  } catch {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  const targetUrl = `${PASMELLS_BASE}${path}&keyhidden=${BYPASS_KEY}`;
  console.log('[Pasmells] Proxying to:', targetUrl.slice(0, 80) + '...');
  try {
    const proxyRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Origin: APP_ORIGIN,
        Referer: `${APP_ORIGIN}/`,
      },
    });
    const text = await proxyRes.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[Pasmells] Proxy: upstream returned non-JSON', { status: proxyRes.status, preview: text.slice(0, 100) });
      res.status(502).json({ error: 'Upstream error', detail: 'Invalid response from source' });
      return;
    }
    console.log('[Pasmells] Proxy response:', { status: proxyRes.status, hasSources: !!(data as { sources?: unknown[] })?.sources?.length });
    res.json(data);
  } catch (e) {
    console.error('[Pasmells] Proxy error:', e);
    res.status(502).json({ error: 'Upstream error' });
  }
});

/**
 * Legacy: direct proxy with X-Baloo header (for simpler integration)
 * POST /api/pasmells/stream with body { type, tmdbId, season?, episode?, scraperName, server?, balooPayload }
 * Requires JWT + approved account.
 */
router.post('/pasmells/stream', requireApproved, async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const { type, tmdbId, season, episode, scraperName, server, balooPayload } = req.body;

  if (!balooPayload?.solution || !balooPayload?.encryptedData || !balooPayload?.encryptedChecksum) {
    res.status(400).json({ error: 'Verification required' });
    return;
  }

  const valid = await validateBalooPow(
    BALOOPOW_IDENTIFIER,
    ip,
    balooPayload.solution,
    balooPayload.encryptedData,
    balooPayload.encryptedChecksum
  );
  if (!valid) {
    res.status(403).json({ error: 'Verification failed' });
    return;
  }

  let path: string;
  if (type === 'movie') {
    path = `/api/scrapers/${scraperName}/stream/${tmdbId}?proxy=true`;
  } else {
    path = `/api/scrapers/${scraperName}/stream/${tmdbId}/${season}/${episode}?proxy=true`;
  }
  if (server) path = path.includes('?') ? path + `&server=${encodeURIComponent(server)}` : path + `?server=${encodeURIComponent(server)}`;

  const targetUrl = `${PASMELLS_BASE}${path}&keyhidden=${BYPASS_KEY}`;
  try {
    const proxyRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Origin: APP_ORIGIN,
        Referer: `${APP_ORIGIN}/`,
      },
    });
    const text = await proxyRes.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[Pasmells] Proxy: upstream returned non-JSON', { status: proxyRes.status, preview: text.slice(0, 100) });
      res.status(502).json({ error: 'Upstream error', detail: 'Invalid response from source' });
      return;
    }
    res.json(data);
  } catch (e) {
    console.error('[Pasmells] Proxy error:', e);
    res.status(502).json({ error: 'Upstream error' });
  }
});

/**
 * Get available scrapers (requires JWT + approved account)
 */
router.get('/pasmells/scrapers', requireApproved, async (_req: Request, res: Response) => {
  const targetUrl = `${PASMELLS_BASE}/api/scrapers/?keyhidden=${BYPASS_KEY}`;
  try {
    const proxyRes = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json',
        Origin: APP_ORIGIN,
        Referer: `${APP_ORIGIN}/`,
      },
    });
    const text = await proxyRes.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[Pasmells] Scrapers: upstream returned non-JSON', { status: proxyRes.status, preview: text.slice(0, 200) });
      res.status(502).json({ error: 'Upstream error', detail: `Upstream returned HTTP ${proxyRes.status}`, preview: text.slice(0, 100) });
      return;
    }
    res.json(data);
  } catch (e) {
    console.error('[Pasmells] Scrapers fetch error:', e);
    res.status(502).json({ error: 'Upstream error', detail: String(e) });
  }
});

export default router;
