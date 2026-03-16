import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { getTrending, getImageUrl, type TMDBItem, getDisplayTitle } from '@/lib/tmdb';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Turnstile } from '@marsidev/react-turnstile';
import { Mail, Lock, ArrowRight, Film, Eye, EyeOff, Loader2 } from 'lucide-react';

const Auth: React.FC = () => {
  usePageTitle("Sign in • Uira.Live");
  const { login, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);
  
  // Background state
  const [backgroundItems, setBackgroundItems] = useState<TMDBItem[]>([]);

  // Fetch background images
  useEffect(() => {
    getTrending().then((data: TMDBItem[]) => {
      setBackgroundItems(data.slice(0, 20));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!turnstileToken) {
      setError('Please complete the verification');
      return;
    }
    
    setIsLoading(true);
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.token) {
          const user = data.user || {
            id: data.userId || '1',
            email: email,
            username: email.split('@')[0],
          };
          await login(data.token, user);
          navigate('/');
        }
      } else {
        setError(data.error || 'Something went wrong');
        // Reset turnstile on error
        resetTurnstile();
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileError(false);
    setTurnstileKey(prev => prev + 1);
  };

  const handleTurnstileError = () => {
    setTurnstileError(true);
    setError('Verification failed. Please try again.');
    resetTurnstile();
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
            <p className="text-white/60">
              Signed in as {user?.email}
            </p>
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
      {/* Left side - Background with posters */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070505] via-[#070505]/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070505] via-transparent to-[#070505]/50 z-10" />
        
        {/* Poster grid */}
        <div className="absolute inset-0 grid grid-cols-4 gap-3 p-4 opacity-40">
          {backgroundItems.map((item, index) => (
            <div
              key={index}
              className="relative aspect-[2/3] rounded-lg overflow-hidden"
              style={{
                transform: `translateY(${index % 2 === 0 ? '-20px' : '20px'})`,
              }}
            >
              <img
                src={getImageUrl(item.poster_path, 'w342')}
                alt={getDisplayTitle(item)}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
          ))}
        </div>

        {/* Content overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center p-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Film className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Uira.Live</span>
            </div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Your Ultimate<br />
              <span className="text-white/60">Streaming Destination</span>
            </h1>
            <p className="text-white/50 text-lg">
              Discover movies, TV shows, and create your personal watchlist. 
              All in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
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
              <p className="text-white/50 text-sm">
                {isLogin ? 'Sign in to continue watching' : 'Start your streaming journey'}
              </p>
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

              {/* Turnstile verification */}
              <div className="flex justify-center py-2">
                <Turnstile
                  key={turnstileKey}
                  siteKey="1x00000000000000000000AA"
                  onSuccess={(token) => {
                    setTurnstileToken(token);
                    setTurnstileError(false);
                    setError('');
                  }}
                  onError={handleTurnstileError}
                  options={{
                    theme: 'dark',
                    size: 'normal',
                  }}
                />
              </div>
              {turnstileError && (
                <p className="text-xs text-red-400 text-center">Verification failed. Please try again.</p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                className="w-full bg-white text-[#070505] font-semibold py-3.5 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 group"
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
                    resetTurnstile();
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

export default Auth;
