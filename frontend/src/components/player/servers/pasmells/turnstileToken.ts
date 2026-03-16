/**
 * Pasmells Turnstile token store.
 *
 * Tokens are single-use (CF validates each token only once, 5-min expiry).
 * We consume the token on first read so every request gets a fresh one.
 *
 * After a token is consumed we call executeCallback so the widget immediately
 * starts generating the next token (pipelining), minimising wait on the next
 * request.
 */

const SITE_KEY = import.meta.env.VITE_PASMELLS_TURNSTILE_SITE_KEY || '';

/** Cached token (no waiter yet when it arrived). */
let currentToken: string | null = null;

/** Queue of pending getPasmellsTurnstileToken() callers, oldest first. */
const waiters: Array<(t: string) => void> = [];

/** Injected by PasmellsTurnstile so we can pipeline fresh challenges. */
let executeCallback: (() => void) | null = null;
export function setTurnstileExecuteCallback(fn: (() => void) | null): void {
  executeCallback = fn;
}
/** Only clears the callback if it is still the one `fn` registered.
 *  Prevents the unmounting Home widget from nulling out the Player widget's callback
 *  when both are briefly mounted during a route transition. */
export function unsetTurnstileExecuteCallback(fn: () => void): void {
  if (executeCallback === fn) {
    executeCallback = null;
  }
}

/** Ask the widget to start a new challenge — called after token consumption. */
function reExecute(): void {
  // Delay slightly so CF can register the current submission before reset
  setTimeout(() => executeCallback?.(), 300);
}

/**
 * Called by the Turnstile component on success (token) or null (expire/error).
 */
export function setPasmellsTurnstileToken(token: string | null): void {
  console.log('[TurnstileToken] set:', { hasToken: !!token, waiters: waiters.length });
  if (!token) {
    currentToken = null;
    return;
  }

  if (waiters.length > 0) {
    // Deliver directly to the oldest waiting request – token is consumed.
    const resolve = waiters.shift()!;
    resolve(token);
    // Pipeline: start generating the next token immediately.
    reExecute();
  } else {
    // No one waiting yet – cache it for the next getPasmellsTurnstileToken().
    currentToken = token;
  }
}

const TIMEOUT_MS = 30_000;

/**
 * Returns a Turnstile token. Each call consumes one token:
 *  - If a token is cached, returns it immediately and triggers pre-fetch.
 *  - Otherwise queues the caller until the widget produces a new token.
 */
export function getPasmellsTurnstileToken(): Promise<string> {
  if (!SITE_KEY) return Promise.reject(new Error('Pasmells Turnstile not configured'));

  if (currentToken) {
    const token = currentToken;
    currentToken = null; // consume
    // Pipeline the next token for subsequent requests
    reExecute();
    console.log('[TurnstileToken] returning cached token');
    return Promise.resolve(token);
  }

  console.log('[TurnstileToken] queuing waiter #', waiters.length + 1);
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const onToken = (t: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(tid);
      resolve(t);
    };

    waiters.push(onToken);

    const tid = setTimeout(() => {
      if (settled) return;
      settled = true;
      const i = waiters.indexOf(onToken);
      if (i >= 0) waiters.splice(i, 1);
      reject(new Error('Turnstile timed out — please refresh the page'));
    }, TIMEOUT_MS);
  });
}

export { SITE_KEY as PASMELLS_TURNSTILE_SITE_KEY };

