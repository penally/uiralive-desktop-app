/**
 * Fingerprint token issuance + verification, and session binding tokens.
 *
 * Chain:
 *   1. Browser runs JS → generates rich fingerprint (canvas, WebGL, audio)
 *   2. POST /api/fp/register → server validates quality → issues short-lived fpToken
 *   3. POST /api/baloo/create-auth { fpToken } → server verifies & burns token
 *                                              → issues publicKey + sessionToken
 *   4. Client solves PoW → POST /auth/register { balooPow, sessionToken }
 *   5. auth.ts verifies sessionToken proves the challenge was created via our gate
 *
 * A pure requests script can't reach step 2 because:
 *   - audioHash requires OfflineAudioContext (no audio stack outside a browser)
 *   - webglRenderer exposes Mesa/SwiftShader for headless VMs → blocked
 *   - canvasHash requires 2D canvas rendering (text anti-aliasing, GPU compositing)
 */

import crypto from 'crypto';

// Secrets — set in environment for stability across restarts.
// Falls back to a random secret per-process (protects production if not set).
const FP_TOKEN_SECRET =
  process.env.FP_TOKEN_SECRET ?? crypto.randomBytes(32).toString('hex');
const SESSION_BINDING_SECRET =
  process.env.SESSION_BINDING_SECRET ?? crypto.randomBytes(32).toString('hex');
const FP_CHALLENGE_SECRET =
  process.env.FP_CHALLENGE_SECRET ?? crypto.randomBytes(32).toString('hex');

const FP_TOKEN_TTL_S    = 90;              // 90 s — only needs to survive from fp collect → create-auth
const FP_CHALLENGE_TTL_S = 2 * 60;        // 2 min — must be solved before fp/register

// ─── Canvas fingerprint challenge ─────────────────────────────────────────
//
// Issued by GET /api/fp/challenge before the browser collects its fingerprint.
// The nonce is drawn on the challenge canvas and folded into the sha256 hash,
// so every fp/register submission is cryptographically tied to one nonce.
// Format of challengeToken: "issuedAt:nonce16hex:hmac"

const usedChallengeTokens = new Set<string>();
setInterval(() => {
  // Challenges expire after 2 min; clearing every 3 min is safe.
  if (usedChallengeTokens.size > 50000) usedChallengeTokens.clear();
}, 3 * 60 * 1000);

/**
 * Issue a short-lived, single-use challenge nonce for the canvas proof.
 * The client must draw this nonce on its canvas and include the resulting
 * SHA256 hash in the fingerprint payload.
 */
export function issueFpChallenge(): { challengeToken: string; nonce: string } {
  const nonce    = crypto.randomBytes(8).toString('hex');   // 16-char hex
  const issuedAt = Date.now().toString();
  const mac      = crypto
    .createHmac('sha256', FP_CHALLENGE_SECRET)
    .update(`${issuedAt}:${nonce}`)
    .digest('hex');
  return { challengeToken: `${issuedAt}:${nonce}:${mac}`, nonce };
}

/**
 * Verify a challenge token and burn it (single-use).
 * Returns the embedded nonce on success so the server can verify canvasNonceHash.
 */
export function verifyFpChallenge(token: string): { ok: boolean; nonce?: string } {
  if (!token || typeof token !== 'string') return { ok: false };
  const parts = token.split(':');
  if (parts.length !== 3) return { ok: false };
  const [issuedAt, nonce, mac] = parts;
  // TTL check
  if (Date.now() - parseInt(issuedAt, 10) > FP_CHALLENGE_TTL_S * 1000) return { ok: false };
  // HMAC check
  const expected = crypto
    .createHmac('sha256', FP_CHALLENGE_SECRET)
    .update(`${issuedAt}:${nonce}`)
    .digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(mac,      'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false };
  } catch {
    return { ok: false };
  }
  // Single-use burn
  if (usedChallengeTokens.has(token)) return { ok: false };
  usedChallengeTokens.add(token);
  return { ok: true, nonce };
}

// ─── Known headless / VM WebGL renderer strings ────────────────────────────

const HEADLESS_RENDERERS = [
  'swiftshader',
  'llvmpipe',
  'mesa',
  'softpipe',
  'vmware svga',
  'vmware',
  'virtualbox',
  'parallels',
  'microsoft basic render driver',
  'angle (google, vulkan 1.1.0 (swiftshader',
  // Note: "angle (intel" / "angle (amd" / "angle (nvidia" are real hardware — do NOT block
];

// ─── Fingerprint quality validation ───────────────────────────────────────

export interface BrowserFingerprintPayload {
  canvasHash: string;
  webglRenderer: string;
  webglVendor: string;
  audioHash: string;
  fontCount: number;
  timingNonce: string;
  languages: string;
  platform: string;
  timezone: string;
  screenRes: string;
  colorDepth: number;
  cookiesEnabled: boolean;
  touchPoints: number;
  webdriver: boolean;
  pixelRatio: number;
  hardwareConcurrency: number;
  hash: string; // client-computed djb2 over all fields
  // New bot-detection fields (optional for backwards compat during rollout)
  automationFlags?: string;   // comma-separated automation markers detected client-side
  outerSize?: string;         // window.outerWidth x window.outerHeight
  hasSpeechSynthesis?: boolean;
  gpuWorkerMatch?: boolean;   // main thread vs worker OffscreenCanvas WebGL renderer match
  workerUaMatch?: boolean;    // navigator.userAgent same inside Worker as main thread
  // Challenge-bound canvas proof — SHA256(canvas_with_nonce.toDataURL() + ":" + nonce)
  // Tied to a single-use server nonce so this value can never be precomputed or reused.
  canvasNonceHash?: string;
}

export interface FingerprintValidationResult {
  ok: boolean;
  reason?: string;
  score: number;
}

export function validateFingerprintQuality(
  fp: BrowserFingerprintPayload | null | undefined,
): FingerprintValidationResult {
  if (!fp) return { ok: false, reason: 'no fingerprint submitted', score: 100 };

  // ── Hard blocks ──────────────────────────────────────────────────────────
  if (fp.webdriver === true) {
    return { ok: false, reason: 'webdriver flag set', score: 100 };
  }

  const renderer = (fp.webglRenderer || '').toLowerCase();
  for (const h of HEADLESS_RENDERERS) {
    if (renderer.includes(h)) {
      return { ok: false, reason: `headless renderer: ${fp.webglRenderer}`, score: 100 };
    }
  }

  if (!fp.canvasHash || fp.canvasHash === 'empty' || fp.canvasHash === '00000000') {
    return { ok: false, reason: 'blank canvas fingerprint', score: 100 };
  }

  // Require a real audio fingerprint — '0' means AudioContext unavailable (headless)
  if (!fp.audioHash || fp.audioHash === '0') {
    return { ok: false, reason: 'no audio fingerprint (AudioContext unavailable)', score: 100 };
  }

  // ── Automation globals / CDP (hard block on unambiguous signals) ─────────
  const HARD_AUTO_FLAGS = ['pw_init', 'pw_binding', 'pw_global', 'nightmare', 'puppeteer',
                           'open_tampered', 'click_tampered', 'cdp', 'pw_exposed_fn'];
  if (fp.automationFlags) {
    const flags = fp.automationFlags.split(',').map(f => f.trim()).filter(Boolean);
    const hit = flags.find(f => HARD_AUTO_FLAGS.includes(f));
    if (hit) return { ok: false, reason: `automation detected: ${hit}`, score: 100 };
  }

  // GPU renderer mismatch between main thread and Worker — indicates hook/spoofing
  if (fp.gpuWorkerMatch === false) {
    return { ok: false, reason: 'GPU renderer mismatch between main thread and worker', score: 100 };
  }

  // Worker UA mismatch — spoofed UA won’t propagate consistently into Workers
  if (fp.workerUaMatch === false) {
    return { ok: false, reason: 'User-Agent mismatch between main thread and worker', score: 100 };
  }

  // ── Soft scoring ─────────────────────────────────────────────────────────
  let score = 0;

  // Headless browsers typically have 0-1 detected fonts
  if (fp.fontCount < 3) score += 35;

  // Missing language list
  if (!fp.languages || fp.languages === 'undefined') score += 20;

  // Unknown platform
  if (!fp.platform || fp.platform === 'unknown') score += 15;

  // Invalid color depth
  if (fp.colorDepth < 16) score += 20;

  // No timing entropy — performance.now() should always return non-zero
  if (!fp.timingNonce || fp.timingNonce === '0') score += 15;

  // Cookies disabled — almost never in a real browser
  if (fp.cookiesEnabled === false) score += 10;

  // No pixel ratio — headless VMs often return 0 or 1 at exactly 100
  if (!fp.pixelRatio || fp.pixelRatio < 100) score += 10;

  // Headless outer dimensions (0x0 = window has no visible frame)
  if (fp.outerSize === '0x0') score += 30;

  // No speech synthesis — real browsers always expose it
  if (fp.hasSpeechSynthesis === false) score += 20;

  // Soft automation flags: UA spoofing signs and Chrome stub
  if (fp.automationFlags) {
    const flags = fp.automationFlags.split(',').map(f => f.trim()).filter(Boolean);
    const SOFT_FLAGS = ['chrome_no_uad', 'ff_has_uad', 'win_ua_mismatch', 'chrome_stub'];
    const softHits = flags.filter(f => SOFT_FLAGS.includes(f)).length;
    score += softHits * 15;
  }

  // Exact headless default resolutions (800×600, 1280×720)
  if (fp.screenRes === '800x600' || fp.screenRes === '1280x720') score += 20;

  // Low font count — headless browsers and stripped-down environments detect very few.
  // Real Windows + Chrome detects 50-200 fonts from the CSS probe set.
  // Bot sends 20, which is suspicious but not zero.
  if (fp.fontCount < 30) score += 20;

  const ok = score < 50;
  return { ok, score, reason: ok ? undefined : `suspicious signals, score ${score}` };
}

// ─── Fingerprint token (fp gate) ──────────────────────────────────────────

interface FpPayload {
  h: string;    // fp hash
  ip: string;   // first 16 chars of client IP
  iat: number;  // issued-at unix seconds
  f?: string;  // server-computed fpId (device identity)
}

// Single-use: once a token is consumed on create-auth it can't be reused
const usedFpTokens = new Set<string>();

setInterval(() => {
  // Prevent unbounded growth — TTL is 90s so clearing every 5 min is safe
  if (usedFpTokens.size > 10000) usedFpTokens.clear();
}, 5 * 60 * 1000);

function b64safe(input: Buffer): string {
  return input.toString('base64url');
}

export function issueFingerprintToken(fpHash: string, ip: string, fpId?: string): string {
  const payload: FpPayload = {
    h:   fpHash,
    ip:  ip.slice(0, 16),
    iat: Math.floor(Date.now() / 1000),
    ...(fpId ? { f: fpId } : {}),
  };
  const payloadB64 = b64safe(Buffer.from(JSON.stringify(payload)));
  const sig = crypto
    .createHmac('sha256', FP_TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyFingerprintToken(
  token: string,
  ip: string,
): { ok: boolean; reason?: string; payload?: FpPayload } {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };

  const dot = token.indexOf('.');
  if (dot < 1) return { ok: false, reason: 'malformed' };

  const payloadB64 = token.slice(0, dot);
  const sig        = token.slice(dot + 1);

  const expectedSig = crypto
    .createHmac('sha256', FP_TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');

  // Constant-time comparison avoids timing oracle
  try {
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expectedSig, 'base64url');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: 'bad signature' };
    }
  } catch {
    return { ok: false, reason: 'signature error' };
  }

  let payload: FpPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as FpPayload;
  } catch {
    return { ok: false, reason: 'parse error' };
  }

  if (Math.floor(Date.now() / 1000) - payload.iat > FP_TOKEN_TTL_S) {
    return { ok: false, reason: 'expired' };
  }

  // IP prefix check (first 16 chars covers IPv4 + IPv6 prefixes)
  if (!ip.startsWith(payload.ip)) {
    console.warn('[FP] IP mismatch', { stored: payload.ip, actual: ip.slice(0, 16) });
    return { ok: false, reason: 'ip mismatch' };
  }

  if (usedFpTokens.has(token)) {
    return { ok: false, reason: 'already consumed' };
  }

  return { ok: true, payload };
}

/** Call this when the fpToken has passed verification and will be used. */
export function consumeFingerprintToken(token: string): void {
  usedFpTokens.add(token);
}

// ─── timingNonce single-use dedup ─────────────────────────────────────────
//
// navigator.performance.now() produces a floating-point string that is unique
// per browser tab per page load.  A bot with a hardcoded nonce will collide on
// every run — burning the nonce after first use locks it out permanently.
// We only need to remember nonces for as long as an fpToken is valid (90 s);
// prune every 2 minutes to bound memory.

const usedTimingNonces = new Map<string, number>(); // nonce → expiry ms

setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of usedTimingNonces) {
    if (now > exp) usedTimingNonces.delete(k);
  }
}, 2 * 60 * 1000);

/**
 * Returns false if this timingNonce was already seen within the TTL window.
 * Burns the nonce on first call (single-use).
 */
export function consumeTimingNonce(nonce: string): boolean {
  if (!nonce || nonce === '0') return true; // missing nonce — other checks handle it
  const key = nonce.slice(0, 32); // cap length to prevent DoS
  if (usedTimingNonces.has(key)) return false;
  usedTimingNonces.set(key, Date.now() + FP_TOKEN_TTL_S * 1000 * 2);
  return true;
}

// ─── Server-side device identity (fpId) ───────────────────────────────────
//
// Derived from the three signals a Python script cannot trivially spoof on
// every run without knowing what values a real NVIDIA/RTX 3060 produces:
//   canvasHash  — CPU + GPU compositing pipeline
//   audioHash   — OS audio stack + resampling coefficients
//   webglRenderer — driver string
//
// Keyed with a secret so the fpId can't be precomputed externally.

const FP_ID_SECRET =
  process.env.FP_ID_SECRET ?? crypto.randomBytes(32).toString('hex');

/**
 * Compute a stable, pseudonymous device identifier from browser-exclusive
 * hardware signals.  Same hardware → same fpId every session.
 * Different hardware or spoofed values → different fpId.
 */
export function computeServerFpId(fp: BrowserFingerprintPayload): string {
  return crypto
    .createHmac('sha256', FP_ID_SECRET)
    .update(`${fp.canvasHash}|${fp.audioHash}|${fp.webglRenderer}|${fp.webglVendor}`)
    .digest('hex')
    .slice(0, 32); // 128-bit — enough entropy, shorter storage
}

/**
 * Recompute the client-side djb2 hash server-side and verify it matches fp.hash.
 *
 * The frontend computes: djb2(JSON.stringify(fp)) over all fields EXCEPT hash,
 * in the exact order they appear in the BrowserFingerprint interface:
 *   canvasHash, webglRenderer, webglVendor, audioHash, fontCount, timingNonce,
 *   languages, platform, timezone, screenRes, colorDepth, cookiesEnabled,
 *   touchPoints, webdriver, pixelRatio, hardwareConcurrency, automationFlags,
 *   outerSize, hasSpeechSynthesis, gpuWorkerMatch, workerUaMatch
 *
 * A bot that changes timingNonce (to avoid the nonce-burn) but doesn't
 * recompute fp.hash will be caught here.
 */
export function verifyFingerprintHash(fp: BrowserFingerprintPayload): boolean {
  if (!fp.hash) return false;
  // Reconstruct the exact object the browser passed to hashFingerprint()
  // — field ORDER matters because JSON.stringify preserves insertion order.
  const canonical = {
    canvasHash:          fp.canvasHash,
    webglRenderer:       fp.webglRenderer,
    webglVendor:         fp.webglVendor,
    audioHash:           fp.audioHash,
    fontCount:           fp.fontCount,
    timingNonce:         fp.timingNonce,
    languages:           fp.languages,
    platform:            fp.platform,
    timezone:            fp.timezone,
    screenRes:           fp.screenRes,
    colorDepth:          fp.colorDepth,
    cookiesEnabled:      fp.cookiesEnabled,
    touchPoints:         fp.touchPoints,
    webdriver:           fp.webdriver,
    pixelRatio:          fp.pixelRatio,
    hardwareConcurrency: fp.hardwareConcurrency,
    automationFlags:     fp.automationFlags ?? '',
    outerSize:           fp.outerSize ?? '',
    hasSpeechSynthesis:  fp.hasSpeechSynthesis ?? false,
    gpuWorkerMatch:      fp.gpuWorkerMatch ?? true,
    workerUaMatch:       fp.workerUaMatch ?? true,
    // Challenge-bound canvas hash — must be present and covered by the djb2.
    // Server can't verify the pixel content, but nonce-binding means it can
    // never be a precomputed static value.
    canvasNonceHash:     fp.canvasNonceHash ?? '',
  };
  const str = JSON.stringify(canonical);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  const expected = (h >>> 0).toString(16).padStart(8, '0');
  return expected === fp.hash;
}

// ─── Session binding token ─────────────────────────────────────────────────
//
// Issued by create-auth alongside the publicKey.  Must be sent back with the
// final /auth/register or /auth/login request to prove:
//   "this solution was produced by a widget that went through our fp gate"
//
// Format: "<16-byte-nonce-hex>:<hmac-hex>"
// Storage: Map<publicKey, { token, createdAt }>  (server-side only)

const SESSION_BINDING_TTL_MS = 15 * 60 * 1000;

/**
 * Stateless session binding token — HMAC only, no server-side Map.
 * Survives server restarts and works across multiple instances.
 * Format: "<issuedAt-ms>:<nonce-hex>:<fpId>:<hmac-hex>"
 * The fpId (first 32 hex chars of the device HMAC) is embedded so auth.ts
 * can enforce per-device registration caps without a DB lookup.
 */
export function issueSessionBindingToken(publicKey: string, fpId: string): string {
  const nonce    = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now().toString();
  const mac      = crypto
    .createHmac('sha256', SESSION_BINDING_SECRET)
    .update(`${publicKey}:${issuedAt}:${nonce}:${fpId}`)
    .digest('hex');
  return `${issuedAt}:${nonce}:${fpId}:${mac}`;
}

export interface SessionBindingResult {
  ok: boolean;
  fpId?: string;
}

export function verifySessionBindingToken(publicKey: string, sessionToken: string): SessionBindingResult {
  if (!publicKey || !sessionToken) return { ok: false };
  try {
    // Support both old 3-part tokens (no fpId) and new 4-part tokens.
    const parts = sessionToken.split(':');
    if (parts.length === 3) {
      // Legacy token (no fpId) — validate but return empty fpId.
      const [issuedAt, nonce, mac] = parts;
      if (Date.now() - parseInt(issuedAt, 10) > SESSION_BINDING_TTL_MS) return { ok: false };
      const expected = crypto
        .createHmac('sha256', SESSION_BINDING_SECRET)
        .update(`${publicKey}:${issuedAt}:${nonce}`)
        .digest('hex');
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(mac, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false };
      return { ok: true, fpId: '' };
    }
    if (parts.length !== 4) return { ok: false };
    const [issuedAt, nonce, fpId, mac] = parts;
    // TTL check
    if (Date.now() - parseInt(issuedAt, 10) > SESSION_BINDING_TTL_MS) return { ok: false };
    // Recompute HMAC (covers all 4 fields — fpId is authenticated)
    const expected = crypto
      .createHmac('sha256', SESSION_BINDING_SECRET)
      .update(`${publicKey}:${issuedAt}:${nonce}:${fpId}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(mac,      'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false };
    return { ok: true, fpId };
  } catch {
    return { ok: false };
  }
}
