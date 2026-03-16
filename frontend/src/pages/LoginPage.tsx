import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api/backend";
import {
  getTrending,
  getImageUrl,
  type TMDBItem,
  getDisplayTitle,
} from "@/lib/tmdb";
import { Mail, Lock, ArrowRight, Film, Eye, EyeOff, Loader2 } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { BalooPowLoginWidget, type BalooPowLoginResult, burnPublicKey } from "@/components/player/servers/pasmells/BalooPowLoginWidget";
import { resetBalooPow } from "@/components/player/servers/pasmells/balooPow";
import { PASMELLS_TURNSTILE_SITE_KEY } from "@/components/player/servers/pasmells/turnstileToken";

/** When true: show only the welcome-back box when logged in; hide background/marketing when not; remove "Sign in to continue watching" */
const MINIMAL_LOGIN_UI = true;

const LoginPage: React.FC = () => {
  usePageTitle("Login • Uira.Live");
  const navigate = useNavigate();
  const { login, isAuthenticated, user, logout } = useAuth();
  // ── Signal collection ────────────────────────────────────────────────────
  const mountTimeRef        = useRef(Date.now());
  const firstInteractRef    = useRef<number>(0);
  const mouseMovementsRef   = useRef(0);

  useEffect(() => {
    const onMove = () => { mouseMovementsRef.current += 1; };
    const onInteract = () => {
      if (!firstInteractRef.current) firstInteractRef.current = Date.now();
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('keydown',   onInteract, { passive: true, once: true });
    window.addEventListener('pointerdown', onInteract, { passive: true, once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown',   onInteract);
      window.removeEventListener('pointerdown', onInteract);
    };
  }, []);

  const collectSignals = useCallback(() => {
    const now = Date.now();
    const mount = mountTimeRef.current;
    // Canvas fingerprint — draw text + gradient and hash the pixel data
    let canvasHash = 'empty';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200; canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 1, 80, 30);
        ctx.fillStyle = '#069';
        ctx.font = '14px Arial';
        ctx.fillText('UiraLive\ud83d\ude80', 2, 22);
        ctx.fillStyle = 'rgba(102,204,0,0.7)';
        ctx.font = '12px sans-serif';
        ctx.fillText('verify_2026', 4, 36);
        const data = canvas.toDataURL();
        // Simple djb2 hash
        let h = 5381;
        for (let i = 0; i < data.length; i++) h = ((h << 5) + h) ^ data.charCodeAt(i);
        canvasHash = (h >>> 0).toString(16);
      }
    } catch { /* ignore */ }

    return {
      loadToSubmitMs:       now - mount,
      loadToFirstInteractMs: firstInteractRef.current ? firstInteractRef.current - mount : 0,
      mouseMovements:       mouseMovementsRef.current,
      webdriver:            !!(navigator as unknown as Record<string, unknown>).webdriver,
      languages:            (navigator.languages ?? []).join(','),
      platform:             navigator.platform || 'unknown',
      timezone:             Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenRes:            `${screen.width}x${screen.height}`,
      colorDepth:           screen.colorDepth,
      canvasHash,
      cookiesEnabled:       navigator.cookieEnabled,
      touchPoints:          navigator.maxTouchPoints ?? 0,
    };
  }, []);  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  // PoW — set once the widget completes; cleared on failed attempt so widget remounts
  const [powResult, setPowResult] = useState<BalooPowLoginResult | null>(null);
  const [widgetKey, setWidgetKey] = useState(0); // increment to force widget remount

  // Hidden Turnstile (Pasmells keys)
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handlePowComplete = (result: BalooPowLoginResult) => {
    setPowResult(result);
    setError('');
  };

  const resetWidget = () => {
    if (powResult?.encryptedData) burnPublicKey(powResult.encryptedData); // mark this key as burned so next challenge skips it
    resetBalooPow(); // clear in-memory cache + cookie so the widget re-solves fresh
    setPowResult(null);
    setWidgetKey((k) => k + 1);
    setTurnstileToken('');
    setTurnstileKey((k) => k + 1);
  };
  
  // Background state
  const [backgroundItems, setBackgroundItems] = useState<TMDBItem[]>([]);

  // Fetch background images
  useEffect(() => {
    getTrending().then((data: TMDBItem[]) => {
      setBackgroundItems(data.slice(0, 24));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');

    if (!powResult) {
      setError('Please complete the verification above.');
      return;
    }
    if (!turnstileToken) {
      setError('Please complete the verification.');
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          turnstileToken,
          signals: collectSignals(),
          balooPow: {
            solution:          powResult.solution,
            encryptedData:     powResult.encryptedData,
            encryptedChecksum: powResult.encryptedChecksum,
            sessionToken:      powResult.sessionToken,
            publicSalt:        powResult.publicSalt,
            challenge:         powResult.challenge,
          },
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const user = data.user || {
          id: data.userId || '1',
          email: email,
          username: email.split('@')[0],
        };
        await login(data.token, user);
        navigate('/');
      } else {
        setError(data.error || 'Something went wrong');
        // Solution is single-use — always reset after a failed attempt
        resetWidget();
      }
    } catch (err) {
      setError('Network error. Please try again.');
      resetWidget();
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  // If authenticated, show welcome screen
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center mx-auto">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <Film className="w-10 h-10 text-white/70" />
            )}
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
            {!MINIMAL_LOGIN_UI && (
              <p className="text-white/60">Signed in as {user?.email}</p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white text-[#070505] rounded-xl font-semibold hover:bg-white/90 transition-all flex items-center gap-2"
            >
              Go Home
              <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={logout}
              className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex">
      {/* Left side - Background with posters (hidden when MINIMAL_LOGIN_UI) */}
      {!MINIMAL_LOGIN_UI && (
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Deep black fade — covers almost everything, posters just ghost through */}
        <div className="absolute inset-0 bg-[var(--theme-content)]/55 z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070505] via-[#070505]/40 to-[#070505]/20 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070505] via-transparent to-[#070505] z-10" />

        {/* Scrolling poster columns */}
        <div className="absolute inset-0 flex gap-1.5 p-2">
          {([
            { animClass: 'animate-scroll-up',        delay: '0s',    items: backgroundItems.slice(0, 4)  },
            { animClass: 'animate-scroll-down',       delay: '-10s',  items: backgroundItems.slice(4, 8)  },
            { animClass: 'animate-scroll-up-slow',    delay: '-5s',   items: backgroundItems.slice(8, 12) },
            { animClass: 'animate-scroll-down-slow',  delay: '-18s',  items: backgroundItems.slice(12, 16)},
            { animClass: 'animate-scroll-up-fast',    delay: '-8s',   items: backgroundItems.slice(16, 20)},
            { animClass: 'animate-scroll-down',       delay: '-22s',  items: backgroundItems.slice(20, 24)},
          ] as const).map((col, colIndex) => (
            <div key={colIndex} className="flex-1 overflow-hidden">
              <div
                className={col.animClass}
                style={{ animationDelay: col.delay }}
              >
                {[...col.items, ...col.items].map((item, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 opacity-50"
                  >
                    <img
                      src={getImageUrl(item.poster_path, 'w342')}
                      alt={getDisplayTitle(item)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Content overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center p-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <span className="text-2xl font-bold">U</span>
              </div>
              <span className="text-2xl font-bold">Uira.Live</span>
            </div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Your new best friend<br />
              <span className="text-white/60">for streaming media.</span>
            </h1>
            <p className="text-white/50 text-lg">
              Discover movies, TV shows, and create your personal watchlist. All in one place. For free, no hidden fees.
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Right side - Login form */}
      <div className={`flex items-center justify-center p-6 lg:p-12 ${MINIMAL_LOGIN_UI ? 'w-full' : 'w-full lg:w-1/2'}`}>
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Uira.Live</span>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              {!MINIMAL_LOGIN_UI && (
              <p className="text-white/50 text-sm">
                {isLogin ? 'Sign in to continue watching!' : 'Start your streaming journey!'}
              </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/80">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-white/80">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Hidden Turnstile (Pasmells keys) */}
              {PASMELLS_TURNSTILE_SITE_KEY && (
                <div
                  style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none', zIndex: -9999 }}
                  aria-hidden="true"
                >
                  <Turnstile
                    key={turnstileKey}
                    siteKey={PASMELLS_TURNSTILE_SITE_KEY}
                    onSuccess={(token) => {
                      setTurnstileToken(token);
                      setError('');
                    }}
                    onError={() => setError('Verification failed. Please try again.')}
                    options={{ size: 'invisible', theme: 'dark' }}
                  />
                </div>
              )}

              {/* BalooPow manual interactive widget */}
              <div className="py-1">
                <BalooPowLoginWidget
                  key={widgetKey}
                  onComplete={handlePowComplete}
                  onError={() => setError('Verification failed. Please try again.')}
                />
              </div>

              {/* Submit button - always usable */}
              <button
                type="submit"
                className={`w-full bg-white text-[#070505] font-semibold py-3.5 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 group ${isLoading ? 'opacity-70' : ''}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    {isLogin ? 'Sign in' : 'Create account'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center">
              <p className="text-white/50 text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    resetWidget();
                  }}
                  className="ml-2 text-white font-semibold hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-white/30 text-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
