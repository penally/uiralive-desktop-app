/**
 * BalooPow challenge widget - auto-solves on load.
 * Requires script: https://cdn.jsdelivr.net/gh/41Baloo/balooPow@latest/balooPow.api.dark.min.js
 */

import React, { useEffect, useRef, useState } from 'react';
import { createBalooChallenge, getBalooPayloadFromCookie, setBalooPayload } from './balooPow';

declare global {
  interface Window {
    balooPowComplete?: (value: boolean) => void;
  }
}

export interface BalooPowChallengeProps {
  onComplete?: (success: boolean) => void;
  onError?: (err: Error) => void;
  autoSolve?: boolean;
  className?: string;
}

export const BalooPowChallenge: React.FC<BalooPowChallengeProps> = ({
  onComplete,
  onError,
  autoSolve = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { publicKey: pk } = await createBalooChallenge();
        if (cancelled) return;
        setPublicKey(pk);

        window.balooPowComplete = (value: boolean) => {
          if (value) {
            const payload = getBalooPayloadFromCookie();
            if (payload) setBalooPayload(payload);
          }
          onComplete?.(value);
        };
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      delete window.balooPowComplete;
    };
  }, [onComplete, onError]);

  useEffect(() => {
    if (!publicKey || !containerRef.current) return;

    const div = containerRef.current;
    div.innerHTML = '';
    const challenge = document.createElement('div');
    challenge.className = 'balooPow-challenge';
    challenge.setAttribute('data-public-key', publicKey);
    challenge.setAttribute('data-on-complete', 'balooPowComplete');
    if (autoSolve) challenge.setAttribute('data-auto-solve', '');
    challenge.setAttribute('data-powered-domain', 'https://pow-api.bxv.gg');
    div.appendChild(challenge);

    // BalooPow script replaces the div when loaded
    const script = document.querySelector('script[src*="balooPow"]');
    if (script) {
      (window as any).balooPow?.init?.();
    }
  }, [publicKey, autoSolve]);

  if (loading) {
    return (
      <div className={`flex justify-center py-4 ${className}`}>
        <div className="animate-pulse h-16 w-48 bg-white/10 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-400 text-sm py-2 ${className}`}>
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className={`min-h-[64px] ${className}`} />;
};
