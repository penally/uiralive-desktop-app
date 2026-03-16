/**
 * Invisible Cloudflare Turnstile for Pasmells — raw CF API, no wrapper library.
 *
 * Uses explicit rendering with execution: 'execute' per CF SPA docs:
 *   https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 *
 * Flow:
 *  1. Script injected once into <head>.
 *  2. Once window.turnstile is available, render() into the hidden container.
 *  3. Immediately call execute() to start the first challenge.
 *  4. onSuccess → store token in turnstileToken.ts.
 *  5. When a token is consumed, the token store calls back via
 *     setTurnstileExecuteCallback → reset() + execute() to pipeline next token.
 *  6. onExpire / onError → retry with exponential back-off.
 */

import { useEffect, useRef } from 'react';
import {
  setPasmellsTurnstileToken,
  setTurnstileExecuteCallback,
  unsetTurnstileExecuteCallback,
  PASMELLS_TURNSTILE_SITE_KEY,
} from './turnstileToken';
import { waitForBalooPayload } from './balooPow';

const CF_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_ID = 'cf-turnstile-script';
const MAX_RETRIES = 5;

// Minimal typing for the CF global
declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, params: Record<string, unknown>): string | undefined;
      execute(container: HTMLElement): void;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

/** Exported alias kept for back-compat with Player.tsx import. */
export function DelayedPasmellsTurnstile() {
  if (!PASMELLS_TURNSTILE_SITE_KEY) return null;
  return <PasmellsTurnstile />;
}

/**
 * Invisible component that kicks off the BalooPow solve in the background.
 * Mount it on any page so the PoW cookie is ready before the user needs sources.
 * Safe to mount in multiple places — `waitForBalooPayload` is single-flight.
 */
export function BalooPowPrewarm() {
  useEffect(() => {
    waitForBalooPayload().catch((e) =>
      console.warn('[BalooPowPrewarm] background solve failed:', e)
    );
  }, []);
  return null;
}

function PasmellsTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const alive = useRef(true);
  const retries = useRef(0);

  useEffect(() => {
    alive.current = true;

    // ── helpers ──────────────────────────────────────────────────────────────

    function doExecute() {
      if (!alive.current || !containerRef.current || !window.turnstile) return;
      const wid = widgetId.current;
      if (!wid) return;
      console.log('[PasmellsTurnstile] reset + execute');
      window.turnstile.reset(wid);
      // rAF so CF processes the reset before we fire execute
      requestAnimationFrame(() => {
        if (alive.current && containerRef.current && window.turnstile) {
          window.turnstile!.execute(containerRef.current);
        }
      });
    }

    function renderWidget() {
      if (!alive.current || !containerRef.current || !window.turnstile) return;
      if (widgetId.current) return; // already rendered

      console.log('[PasmellsTurnstile] rendering widget');
      const wid = window.turnstile.render(containerRef.current, {
        sitekey: PASMELLS_TURNSTILE_SITE_KEY,
        execution: 'execute',
        appearance: 'always',
        size: 'invisible',
        theme: 'light',
        'refresh-expired': 'never',
        retry: 'never',
        callback(token: string) {
          if (!alive.current) return;
          console.log('[PasmellsTurnstile] success');
          retries.current = 0;
          setPasmellsTurnstileToken(token);
        },
        'expired-callback'() {
          if (!alive.current) return;
          console.log('[PasmellsTurnstile] expired – re-executing');
          setPasmellsTurnstileToken(null);
          doExecute();
        },
        'error-callback'(code: string) {
          if (!alive.current) return;
          setPasmellsTurnstileToken(null);
          if (retries.current >= MAX_RETRIES) {
            console.error('[PasmellsTurnstile] max retries reached, code:', code);
            return;
          }
          const delay = Math.min(1_000 * 2 ** retries.current, 30_000);
          console.log('[PasmellsTurnstile] error', code, '– retrying in', delay, 'ms');
          retries.current++;
          setTimeout(doExecute, delay);
        },
      });

      if (!wid) {
        console.error('[PasmellsTurnstile] render() returned no widgetId');
        return;
      }

      widgetId.current = wid;
      console.log('[PasmellsTurnstile] rendered, widgetId:', wid, '– executing first challenge');

      // First challenge: just execute() — no reset needed before the first run
      window.turnstile.execute(containerRef.current);
    }

    // ── script loading ────────────────────────────────────────────────────────

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function onScriptReady() {
      if (!alive.current) return;
      // Poll until window.turnstile is set (CF may init asynchronously after onload)
      if (window.turnstile) {
        renderWidget();
        return;
      }
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        if (window.turnstile) {
          clearInterval(pollInterval!);
          pollInterval = null;
          if (alive.current) renderWidget();
        } else if (attempts > 200) { // 10 s
          clearInterval(pollInterval!);
          pollInterval = null;
          console.error('[PasmellsTurnstile] timed out waiting for window.turnstile');
        }
      }, 50);
    }

    // Register re-execute hook for the token store (pipelining)
    setTurnstileExecuteCallback(doExecute);

    if (window.turnstile) {
      // Script already loaded from a previous mount
      renderWidget();
    } else if (document.getElementById(SCRIPT_ID)) {
      // Script tag exists but hasn't finished loading yet
      onScriptReady();
    } else {
      // First time — inject the script
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = CF_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = onScriptReady;
      script.onerror = () => console.error('[PasmellsTurnstile] failed to load CF script');
      document.head.appendChild(script);
    }

    // ── cleanup ───────────────────────────────────────────────────────────────
    return () => {
      alive.current = false;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      // Only clear the pipeline callback if it's still ours — prevents the
      // unmounting Home widget from wiping Player's callback during navigation.
      unsetTurnstileExecuteCallback(doExecute);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, []);

  return (
    // Positioned far off-screen with NO overflow clipping so CF's iframe can
    // render at its natural size without being cropped (clipping breaks the PAT
    // / POW challenge computation inside the sandboxed iframe).
    <div
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -9999,
      }}
      aria-hidden="true"
    >
      <div ref={containerRef} />
    </div>
  );
}
