/**
 * BalooPowLoginWidget  Cloudflare Turnstile-style box, themed to match the login page.
 *
 * Idle:   [   Verify ]           [ UiraLive / Protected by UiraLive ]
 * Solving:[   Verifying... ]     [ UiraLive / Protected by UiraLive ]
 * Done:   [   Verified ]         [ UiraLive / Protected by UiraLive ]
 * Error:  [   Retry ]            [ UiraLive / Protected by UiraLive ]
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { loadBalooPowSolver } from './balooPow';
import { collectBrowserFingerprint } from '@/lib/browserFingerprint';

export interface BalooPowLoginResult {
  solution: string;
  encryptedData: string;
  encryptedChecksum: string;
  publicSalt: string;    // the exact salt the solver used
  challenge: string;     // the exact challenge the solver used
  sessionToken: string;  // HMAC-bound proof that this challenge was created through our fp gate
}

interface Props {
  onComplete: (result: BalooPowLoginResult) => void;
  onError?: () => void;
}

type State = 'idle' | 'solving' | 'done' | 'error';

function getApiBase(): string {
  // In dev, return '' so requests go through the Vite proxy (which strips /api).
  // In production, use the absolute backend URL.
  if (import.meta.env?.DEV) return '';
  return (import.meta.env?.VITE_API_BASE_URL as string) || '';
}

// Track publicKeys whose solutions have been burned (submitted & consumed by the server).
// Safety-net: track burned publicKeys so we never accidentally re-submit a spent solution.
// With per-call unique identifiers on the backend, pow-api always returns a fresh key,
// so this set should never actually block — it's a last-resort guard.
const burnedPublicKeys = new Set<string>();

/** Mark a publicKey as burned so it can never be submitted again. */
export function burnPublicKey(key: string): void {
  burnedPublicKeys.add(key);
}

async function runAuthChallenge(): Promise<BalooPowLoginResult> {
  const base = getApiBase();

  // ── Step 0: Obtain a single-use canvas challenge nonce from the server ─────────
  // The nonce is drawn on the challenge canvas so canvasNonceHash is bound to
  // this specific request and can never be a precomputed static value.
  const challengeRes = await fetch(`${base}/api/fp/challenge`);
  if (!challengeRes.ok) throw new Error(`fp/challenge failed: ${challengeRes.status}`);
  const { challengeToken, nonce } = (await challengeRes.json()) as { challengeToken?: string; nonce?: string };
  if (!challengeToken || !nonce) throw new Error('invalid fp/challenge response');

  // ── Step 1: Collect browser fingerprint (canvas draws nonce, computes SHA256) ──
  const fp = await collectBrowserFingerprint(challengeToken, nonce);

  // ── Step 2: Register fingerprint → get fpToken ───────────────────────────
  const fpRes = await fetch(`${base}/api/fp/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fp),
  });
  if (!fpRes.ok) throw new Error(`fp/register failed: ${fpRes.status}`);
  const { fpToken } = (await fpRes.json()) as { fpToken?: string };
  if (!fpToken) throw new Error('no fpToken returned');

  // ── Step 3: Create auth challenge (gated by fpToken) ─────────────────────
  const createRes = await fetch(`${base}/api/baloo/create-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fpToken }),
  });
  if (!createRes.ok) throw new Error(`create-auth failed: ${createRes.status}`);
  const { publicKey, sessionToken } = (await createRes.json()) as { publicKey?: string; sessionToken?: string };
  if (!publicKey || publicKey.length < 10) throw new Error('Invalid publicKey');
  if (!sessionToken) throw new Error('No sessionToken in create-auth response');

  // Safety net: backend uses unique identifiers so this should never trigger.
  if (burnedPublicKeys.has(publicKey)) {
    throw new Error('Received already-burned publicKey — please try again');
  }

  // ── Step 4: Fetch PoW parameters via our proxy (populates server cache) ───
  const powUrl = `${base}/api/pow/${encodeURIComponent(publicKey)}`;
  const powRes = await fetch(powUrl);
  if (!powRes.ok) throw new Error(`challenge fetch failed: ${powRes.status}`);
  const powData = (await powRes.json()) as {
    publicSalt: string;
    difficulty: number;
    challenge: string;
    numeric?: boolean;
  };

  const BalooPowClass = await loadBalooPowSolver();

  // Retry up to 5 times — the worker pool is probabilistic: each attempt spawns
  // fresh workers searching a new random range, so failures are independent.
  let solution = '';
  let encryptedChecksum = '';
  for (let attempt = 1; attempt <= 5; attempt++) {
    const solver = new BalooPowClass(
      powData.publicSalt,
      powData.difficulty,
      powData.challenge,
      powData.numeric !== false,
    );
    let result: { solution: string; access?: string } | null = null;
    try {
      result = (await solver.Solve()) as { solution: string; access?: string } | null;
    } catch {
      // AggregateError — all workers exhausted their ranges; try again
    }
    solution = result?.solution != null ? String(result.solution) : '';
    encryptedChecksum = result?.access || '';
    if (solution && encryptedChecksum) break;
    if (attempt < 5) console.warn(`[BalooPowLoginWidget] solve attempt ${attempt} failed, retrying…`);
  }

  if (!solution) throw new Error('No solution');
  if (!encryptedChecksum) throw new Error('No access hash');

  return {
    solution,
    encryptedData: publicKey,
    encryptedChecksum,
    publicSalt: powData.publicSalt,
    challenge: powData.challenge,
    sessionToken,
  };
}

export function BalooPowLoginWidget({ onComplete, onError }: Props) {
  const [state, setState] = useState<State>('idle');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const handleClick = useCallback(async () => {
    if (state === 'solving' || state === 'done') return;
    if (state === 'error') { setState('idle'); return; }
    setState('solving');
    try {
      const result = await runAuthChallenge();
      if (!alive.current) return;
      setState('done');
      onComplete(result);
    } catch (e) {
      console.error('[BalooPowLoginWidget] solve error:', e);
      if (!alive.current) return;
      setState('error');
      onError?.();
    }
  }, [state, onComplete, onError]);

  const isClickable = state === 'idle' || state === 'error';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable}
      style={{ all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12,
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'border-color 0.15s, background 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (isClickable) {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.25)';
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = stateColor(state, 'border');
          (e.currentTarget as HTMLDivElement).style.background = stateColor(state, 'bg');
        }}
      >
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LeftIcon state={state} />
          <span style={{
            color: stateColor(state, 'text'),
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            transition: 'color 0.15s',
          }}>
            {state === 'idle'    ? 'Verify'       : null}
            {state === 'solving' ? 'Verifying...' : null}
            {state === 'done'    ? 'Verified'     : null}
            {state === 'error'   ? 'Retry'        : null}
          </span>
        </div>

        {/* Right side  branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            UiraLive
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9.5, fontFamily: 'inherit' }}>
            Protected by UiraLive
          </span>
        </div>
      </div>
    </button>
  );
}

function stateColor(state: State, part: 'text' | 'border' | 'bg'): string {
  if (part === 'text') {
    if (state === 'done')  return '#4ade80';
    if (state === 'error') return '#f87171';
    return 'rgba(255,255,255,0.70)';
  }
  if (part === 'border') {
    if (state === 'done')  return 'rgba(74,222,128,0.30)';
    if (state === 'error') return 'rgba(248,113,113,0.30)';
    return 'rgba(255,255,255,0.10)';
  }
  // bg
  if (state === 'done')  return 'rgba(74,222,128,0.05)';
  if (state === 'error') return 'rgba(248,113,113,0.05)';
  return 'rgba(255,255,255,0.05)';
}

function LeftIcon({ state }: { state: State }) {
  if (state === 'solving') {
    return (
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        style={{ animation: 'bpSpin 0.75s linear infinite', flexShrink: 0 }}
      >
        <style>{`@keyframes bpSpin { to { transform: rotate(360deg) } }`}</style>
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(255,255,255,0.70)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === 'done') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke="rgba(74,222,128,0.50)" strokeWidth="2" />
        <path d="M7 13l3.5 3.5L17 8" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'error') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke="rgba(248,113,113,0.50)" strokeWidth="2" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  // idle  plain circle
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.30)" strokeWidth="2" />
    </svg>
  );
}
