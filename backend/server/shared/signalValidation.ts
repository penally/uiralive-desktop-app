/**
 * Browser signal validation + rate limiting for login/register.
 *
 * Layers:
 *  1. IP rate limiting  — sliding window, blocks automated IP spam
 *  2. Email rate limiting — per-address, blocks credential stuffing
 *  3. Disposable email detection — blocks throwaway accounts
 *  4. Browser signal scoring — penalises headless/bot patterns
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserSignals {
  /** ms from component mount to form submit */
  loadToSubmitMs: number;
  /** ms from component mount to first keystroke/click in a field */
  loadToFirstInteractMs: number;
  /** raw count of mousemove events before submit */
  mouseMovements: number;
  /** navigator.webdriver */
  webdriver: boolean;
  /** navigator.languages joined */
  languages: string;
  /** navigator.platform */
  platform: string;
  /** Intl timezone */
  timezone: string;
  /** widthxheight */
  screenRes: string;
  /** screen.colorDepth */
  colorDepth: number;
  /** simple SHA-1-style hash of a canvas draw — detects headless rendering */
  canvasHash: string;
  /** navigator.cookieEnabled */
  cookiesEnabled: boolean;
  /** navigator.maxTouchPoints */
  touchPoints: number;
}

export interface SignalResult {
  ok: boolean;
  reason?: string;
  score: number; // 0 = clean, higher = more suspicious
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface SlidingEntry { times: number[] }

const ipAttempts   = new Map<string, SlidingEntry>();
const emailAttempts = new Map<string, SlidingEntry>();

const IP_WINDOW_MS    = 15 * 60 * 1000; // 15 min
const IP_MAX          = 12;             // attempts per window
const EMAIL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_MAX       = 6;              // attempts per window

function pruneWindow(entry: SlidingEntry, windowMs: number): SlidingEntry {
  const cutoff = Date.now() - windowMs;
  entry.times = entry.times.filter(t => t > cutoff);
  return entry;
}

/** Returns true if allowed, false if rate-limited. Always records the attempt. */
export function checkIpRateLimit(ip: string): boolean {
  const entry = pruneWindow(ipAttempts.get(ip) ?? { times: [] }, IP_WINDOW_MS);
  entry.times.push(Date.now());
  ipAttempts.set(ip, entry);
  return entry.times.length <= IP_MAX;
}

export function checkEmailRateLimit(email: string): boolean {
  const key = email.toLowerCase().trim();
  const entry = pruneWindow(emailAttempts.get(key) ?? { times: [] }, EMAIL_WINDOW_MS);
  entry.times.push(Date.now());
  emailAttempts.set(key, entry);
  return entry.times.length <= EMAIL_MAX;
}

// Periodic cleanup so maps don't grow unboundedly
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipAttempts)    { if (v.times.every(t => t < now - IP_WINDOW_MS))    ipAttempts.delete(k); }
  for (const [k, v] of emailAttempts) { if (v.times.every(t => t < now - EMAIL_WINDOW_MS)) emailAttempts.delete(k); }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Disposable email domains
// ---------------------------------------------------------------------------

const DISPOSABLE_DOMAINS = new Set([
  // developer / testing catch-all domains
  'mailtest.com','test.com','example.com','example.net','example.org',
  'test-mail.com','testmail.com','testemail.com','dev-null.com','devnull.com',
  // classic disposables
  'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
  'guerrillamail.biz','guerrillamail.de','guerrillamail.info','guerrillamailblock.com',
  'grr.la','spam4.me','trashmail.com','trashmail.at','trashmail.io','trashmail.me',
  'trashmail.net','trashmail.org','yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf',
  'nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr','courriel.fr.nf',
  'moncourrier.fr.nf','sharp.igg.biz','yt.bugmenot.com','throwam.com','throwaway.email',
  'tempinbox.com','tempmail.com','tmpmail.net','tmpmail.org','temp-mail.org',
  'dispostable.com','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'mailnull.com','spamcorpse.com','maildrop.cc','sharklasers.com','guerrillamail.info',
  'grr.la','guerrillamail.biz','spam4.me','10minutemail.com','10minutemail.net',
  '10minutemail.org','10minutemail.de','10minutemail.me','10minutemail.us',
  'discard.email','discardmail.com','discardmail.de','filzmail.com','owlpic.com',
  'spamfree24.org','spamfree24.de','spamfree24.eu','spamfree24.info',
  'spamfree24.net','spamfree24.com','spamfree.eu','spam.la','spammotel.com',
  'spaml.de','spaml.com','spamspot.com','spamthisplease.com','spoofmail.de',
  'tempinbox.co.uk','temporaryemail.us','thanksnospam.com','tradermail.info',
  'trash2009.com','trash2010.com','trash2011.com','trashdevil.com','trashdevil.de',
  'trashemail.de','trashimail.de','trashmail.at','trashmail.com','trashmail.me',
  'trashmail.net','trashmail.org','trayna.com','trmailbox.com','tumblr.com',
  'typestring.com','uggsrock.com','uroid.com','fakeinbox.com','fakemail.fr',
  'fakedemail.com','filzmail.de','mailnull.com','mailscrap.com','proxymail.eu',
  'receiveee.com','sofort-mail.de','sofortmail.de','spam4.me','speed.1s.fr',
  // abuse / dev catch-all domains seen in the wild
  'anonbox.net','emailsensei.com','getairmail.com',
  'iheartspam.org','yomail.info','emailnax.com','nwytg.net',
  'chitthi.in','noblepioneer.com','boximail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  return DISPOSABLE_DOMAINS.has(domain);
}

// ---------------------------------------------------------------------------
// Browser signal scoring
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Create-auth challenge rate limiter (separate map — lighter limit)
// ---------------------------------------------------------------------------

const createAuthAttempts = new Map<string, SlidingEntry>();
const CREATE_AUTH_WINDOW_MS = 60 * 1000;   // 1 min
const CREATE_AUTH_MAX       = 5;            // challenges per minute per IP

// Pasmells create rate limiter — slightly higher since the player may prewarm on load
const pasmellsCreateAttempts = new Map<string, SlidingEntry>();
const PASMELLS_CREATE_WINDOW_MS = 60 * 1000;  // 1 min
const PASMELLS_CREATE_MAX       = 8;           // per minute per IP

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of createAuthAttempts) {
    if (v.times.every(t => t < now - CREATE_AUTH_WINDOW_MS)) createAuthAttempts.delete(k);
  }
  for (const [k, v] of pasmellsCreateAttempts) {
    if (v.times.every(t => t < now - PASMELLS_CREATE_WINDOW_MS)) pasmellsCreateAttempts.delete(k);
  }
}, 60 * 1000);

export function checkCreateAuthRateLimit(ip: string): boolean {
  const entry = pruneWindow(createAuthAttempts.get(ip) ?? { times: [] }, CREATE_AUTH_WINDOW_MS);
  entry.times.push(Date.now());
  createAuthAttempts.set(ip, entry);
  return entry.times.length <= CREATE_AUTH_MAX;
}

export function checkPasmellsCreateRateLimit(ip: string): boolean {
  const entry = pruneWindow(pasmellsCreateAttempts.get(ip) ?? { times: [] }, PASMELLS_CREATE_WINDOW_MS);
  entry.times.push(Date.now());
  pasmellsCreateAttempts.set(ip, entry);
  return entry.times.length <= PASMELLS_CREATE_MAX;
}

// ---------------------------------------------------------------------------
// /fp/challenge rate limiter — just issuing a cheap signed nonce (GET endpoint)
// ---------------------------------------------------------------------------

const fpChallengeAttempts = new Map<string, SlidingEntry>();
const FP_CHALLENGE_WINDOW_MS = 5 * 60 * 1000;  // 5 min
const FP_CHALLENGE_MAX       = 60;              // 60 nonces per 5 min per IP
                                                // (player + login + retries
                                                // all share one IP painlessly)

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fpChallengeAttempts) {
    if (v.times.every(t => t < now - FP_CHALLENGE_WINDOW_MS)) fpChallengeAttempts.delete(k);
  }
}, 5 * 60 * 1000);

export function checkFpChallengeRateLimit(ip: string): boolean {
  const entry = pruneWindow(fpChallengeAttempts.get(ip) ?? { times: [] }, FP_CHALLENGE_WINDOW_MS);
  entry.times.push(Date.now());
  fpChallengeAttempts.set(ip, entry);
  return entry.times.length <= FP_CHALLENGE_MAX;
}

// ---------------------------------------------------------------------------
// /fp/register rate limiter — gates the fingerprint quality check itself
// ---------------------------------------------------------------------------

const fpRegisterAttempts = new Map<string, SlidingEntry>();
const FP_REGISTER_WINDOW_MS = 15 * 60 * 1000; // 15 min
const FP_REGISTER_MAX       = 20;              // per IP — raised from 10:
                                               // player + login + 2–3 retries
                                               // = ~4 per session, headroom for
                                               // legitimate multi-tab use

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fpRegisterAttempts) {
    if (v.times.every(t => t < now - FP_REGISTER_WINDOW_MS)) fpRegisterAttempts.delete(k);
  }
}, 5 * 60 * 1000);

export function checkFpRegisterRateLimit(ip: string): boolean {
  const entry = pruneWindow(fpRegisterAttempts.get(ip) ?? { times: [] }, FP_REGISTER_WINDOW_MS);
  entry.times.push(Date.now());
  fpRegisterAttempts.set(ip, entry);
  return entry.times.length <= FP_REGISTER_MAX;
}

// ---------------------------------------------------------------------------
// Per-device (hardware fingerprint) registration limiter
// The server computes a device identity from canvas + audio + GPU renderer —
// three signals that require genuine browser execution to forge convincingly.
// A bot with hardcoded values hits the same fpId every run.
// ---------------------------------------------------------------------------

const fpIdRegistrations = new Map<string, SlidingEntry>();
const FP_ID_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h
const FP_ID_MAX       = 2;                    // accounts per device per day

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fpIdRegistrations) {
    if (v.times.every(t => t < now - FP_ID_WINDOW_MS)) fpIdRegistrations.delete(k);
  }
}, 15 * 60 * 1000);

/**
 * Returns true if this device is still under the registration cap.
 * Does NOT record — call recordFpIdRegistration after the account is created.
 */
export function checkFpIdRegistrationLimit(fpId: string): boolean {
  if (!fpId) return true; // no fpId = let other checks decide
  const entry = pruneWindow(fpIdRegistrations.get(fpId) ?? { times: [] }, FP_ID_WINDOW_MS);
  return entry.times.length < FP_ID_MAX;
}

/** Record a successful registration for this device identity. */
export function recordFpIdRegistration(fpId: string): void {
  if (!fpId) return;
  const entry = pruneWindow(fpIdRegistrations.get(fpId) ?? { times: [] }, FP_ID_WINDOW_MS);
  entry.times.push(Date.now());
  fpIdRegistrations.set(fpId, entry);
}

/** Scores browser signals. Returns ok:false for hard fails, or a suspicion score. */
export function scoreBrowserSignals(signals: BrowserSignals | null | undefined): SignalResult {
  if (!signals) {
    // No signals at all = definite bot / direct HTTP request — hard block
    return { ok: false, reason: 'signals required', score: 100 };
  }

  // Hard fails — instant reject
  if (signals.webdriver === true) {
    return { ok: false, reason: 'automated browser detected', score: 100 };
  }
  if (signals.loadToSubmitMs < 1800) {
    return { ok: false, reason: 'submitted too fast', score: 100 };
  }

  // Soft scoring
  let score = 0;

  // Very fast interaction (< 3 s total load to submit) on a non-mobile device
  if (signals.loadToSubmitMs < 3000 && signals.touchPoints === 0) score += 20;

  // No mouse movements at all on a non-touch device
  if (signals.mouseMovements < 3 && signals.touchPoints === 0) score += 25;

  // First interaction suspiciously instant (< 400 ms from page load)
  if (signals.loadToFirstInteractMs > 0 && signals.loadToFirstInteractMs < 400) score += 15;

  // No canvas hash — headless browsers often fail canvas ops silently
  if (!signals.canvasHash || signals.canvasHash === 'empty' || signals.canvasHash === '0') score += 20;

  // Missing/empty language list
  if (!signals.languages || signals.languages === 'undefined') score += 10;

  // Empty/unknown platform
  if (!signals.platform || signals.platform === 'unknown') score += 10;

  // Cookies disabled (extremely rare in real browsers, common in bots)
  if (signals.cookiesEnabled === false) score += 15;

  // Single-color-depth (headless VMs often report 24 but never < 16 in real browsers)
  if (signals.colorDepth < 16) score += 10;

  // Missing timezone (always present in real browsers)
  if (!signals.timezone || signals.timezone === 'UTC' && !signals.languages) score += 10;

  const ok = score < 40;  // tighter threshold
  return { ok, score, reason: ok ? undefined : `suspicion score ${score}` };
}
