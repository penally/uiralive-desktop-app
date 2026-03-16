import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import HeroCarousel from "@/components/home/Carousel";
import { tmdbApi, type TMDBMovie, type TMDBSeries } from "@/lib/tmdb";
import { User, Sparkles } from "lucide-react";
import { ContinueWatchingRow } from "@/components/home/ContinueWatchingRow";
import { DelayedPasmellsTurnstile, BalooPowPrewarm } from "@/components/player/servers/pasmells/PasmellsTurnstile";

const Home: React.FC = () => {
  usePageTitle("Home • Uira.Live");
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  // Movies
  const [trendingMovies, setTrendingMovies] = useState<TMDBMovie[]>([]);
  const [thrillerMovies, setThrillerMovies] = useState<TMDBMovie[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<TMDBMovie[]>([]);
  const [actionSciFiMovies, setActionSciFiMovies] = useState<TMDBMovie[]>([]);

  // TV
  const [tvNewReleases, setTvNewReleases] = useState<TMDBSeries[]>([]);
  const [tvFamilyDrama, setTvFamilyDrama] = useState<TMDBSeries[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [
          trendingRes,
          thrillerRes,
          horrorRes,
          actionSciFiRes,
          tvNewRes,
          tvFamilyDramaRes,
        ] = await Promise.all([
          tmdbApi.getTrendingMovies(),
          // Thriller
          tmdbApi.discoverMovies({
            with_genres: "53",
            sort_by: "popularity.desc",
          }),
          // Horror
          tmdbApi.discoverMovies({
            with_genres: "27",
            sort_by: "popularity.desc",
          }),
          // Action & Sci‑Fi
          tmdbApi.discoverMovies({
            with_genres: "28,878",
            sort_by: "popularity.desc",
          }),
          // TV • New Releases (current year only)
          tmdbApi.discoverTV({
            sort_by: "first_air_date.desc",
            "first_air_date.gte": `${new Date().getFullYear()}-01-01`,
            "vote_count.gte": 10,
          }),
          // TV • Family & Drama (Family OR Drama, popular)
          tmdbApi.discoverTV({
            with_genres: "10751|18",
            sort_by: "popularity.desc",
            "vote_count.gte": 50,
          }),
        ]);

        setTrendingMovies(trendingRes.results ?? []);
        setThrillerMovies(thrillerRes.results ?? []);
        setHorrorMovies(horrorRes.results ?? []);
        setActionSciFiMovies(actionSciFiRes.results ?? []);
        setTvNewReleases(tvNewRes.results ?? []);
        setTvFamilyDrama(tvFamilyDramaRes.results ?? []);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)]">
      {/* Pre-warm Turnstile + BalooPow so both are ready before user opens player */}
      <DelayedPasmellsTurnstile />
      <BalooPowPrewarm />
      <SidebarNav />
      {/* Hero sits behind the sidebar so the backdrop reaches the far left */}
      <HeroCarousel />

      <main className="sm:ml-28">
        {/* Content below hero, with smooth continuation of the dark backdrop */}
        <div className="relative pt-8 sm:pt-10 px-4 sm:px-8 bg-[var(--theme-content)] space-y-10 pb-12">
          {/* User Welcome Section - Only shown when logged in */}
          {isAuthenticated && user && (
            <section aria-label="User welcome" className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white/10 via-white/5 to-transparent border border-white/10 p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-white/70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    Welcome back, {user.username || user.email?.split('@')[0] || 'User'}!
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    {user.email}
                  </p>
                </div>
              </div>
            </section>
          )}

          <ContinueWatchingRow />

          <section aria-label="Trending movies">
            <MediaCarousel
              title="Trending Now"
              items={trendingMovies.map((movie) => ({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                backdrop_path: movie.backdrop_path,
                release_date: movie.release_date,
                rating: movie.vote_average,
                media_type: "movie" as const,
              }))}
              onItemClick={(item) => {
                navigate(`/movie/${item.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
            />
          </section>

          <section aria-label="Thriller movies">
            <MediaCarousel
              title="Thriller"
              items={thrillerMovies.map((movie) => ({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                backdrop_path: movie.backdrop_path,
                release_date: movie.release_date,
                rating: movie.vote_average,
                media_type: "movie" as const,
              }))}
              onItemClick={(item) => {
                navigate(`/movie/${item.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
            />
          </section>

          <section aria-label="Horror movies">
            <MediaCarousel
              title="Horror"
              items={horrorMovies.map((movie) => ({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                backdrop_path: movie.backdrop_path,
                release_date: movie.release_date,
                rating: movie.vote_average,
                media_type: "movie" as const,
              }))}
              onItemClick={(item) => {
                navigate(`/movie/${item.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
            />
          </section>

          <section aria-label="Action & Sci-Fi">
            <MediaCarousel
              title="Action & Sci‑Fi"
              items={actionSciFiMovies.map((movie) => ({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                backdrop_path: movie.backdrop_path,
                release_date: movie.release_date,
                rating: movie.vote_average,
                media_type: "movie" as const,
              }))}
              onItemClick={(item) => {
                navigate(`/movie/${item.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
            />
          </section>

          {/* TV sections */}
          <section aria-label="TV - New Releases">
            <MediaCarousel
              title="TV • New Releases"
              items={tvNewReleases.map((show) => ({
                id: show.id,
                title: show.name,
                poster_path: show.poster_path,
                backdrop_path: show.backdrop_path,
                release_date: show.first_air_date,
                rating: show.vote_average,
                media_type: "tv" as const,
              }))}
              onItemClick={(item) => {
                navigate(`/tv/${item.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
            />
          </section>

          <section aria-label="TV - Family & Drama">
            <MediaCarousel
              title="TV • Family & Drama"
              items={tvFamilyDrama.map((show) => ({
                id: show.id,
                title: show.name,
                poster_path: show.poster_path,
                backdrop_path: show.backdrop_path,
                release_date: show.first_air_date,
                rating: show.vote_average,
                media_type: "tv" as const,
              }))}
              onItemClick={(item) => {
                navigate(`/tv/${item.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
            />
          </section>

          {/* For You placeholder */}
          <section aria-label="For you">
            <h2 className="mb-3 flex items-center gap-2 text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">
              <span className="h-6 w-1.5 rounded-full bg-white" />
              For You
            </h2>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-white/0 to-white/5 px-6 py-8 sm:px-8 sm:py-10 text-sm sm:text-base text-white/70">
              Personalized picks are{" "}
              <span className="text-white font-semibold">coming soon</span>. Keep
              exploring while we learn what you like.
            </div>
          </section>
        </div>
      </main>

    </div>
  );
};

export default Home;