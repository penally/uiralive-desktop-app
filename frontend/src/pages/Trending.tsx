import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { PageMediaCarousel } from "@/components/media/PageMediaCarousel";
import { tmdbApi, type TMDBMovie, type TMDBSeries } from "@/lib/tmdb";
import { useLocation, useNavigate } from "react-router-dom";

const TrendingPage: React.FC = () => {
  usePageTitle("Trending • Uira.Live");
  const navigate = useNavigate();
  const location = useLocation();

  const [trendingMovies, setTrendingMovies] = useState<TMDBMovie[]>([]);
  const [trendingTv, setTrendingTv] = useState<TMDBSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [moviesRes, tvRes] = await Promise.all([
          tmdbApi.getTrendingMovies(),
          tmdbApi.getTrendingTV(),
        ]);
        setTrendingMovies(moviesRes.results ?? []);
        setTrendingTv(tvRes.results ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const goToMovie = (item: { id: number }) =>
    navigate(`/movie/${item.id}`, { state: { backgroundLocation: location } });

  const goToTv = (item: { id: number }) =>
    navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } });

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex">
      <SidebarNav />

      <main className="flex-1 sm:ml-28 pb-12 pt-6 space-y-10 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-white/10 border-t-white animate-spin" />
            <p className="text-sm text-white/40 tracking-widest uppercase">
              Loading trends
            </p>
          </div>
        ) : (
          <>
            <header className="px-4 sm:px-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                  Trending
                </h1>
                <p className="text-sm text-white/60 max-w-xl mt-1">
                  What everyone&apos;s watching right now, across movies and TV.
                </p>
              </div>
            </header>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Trending Movies"
                items={trendingMovies.map((m) => ({
                  id: m.id,
                  title: m.title,
                  poster_path: m.poster_path,
                  backdrop_path: m.backdrop_path,
                  release_date: m.release_date,
                  rating: m.vote_average,
                  media_type: "movie" as const,
                }))}
                onItemClick={goToMovie}
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Trending TV Shows"
                items={trendingTv.map((s) => ({
                  id: s.id,
                  title: s.name,
                  poster_path: s.poster_path,
                  backdrop_path: s.backdrop_path,
                  release_date: s.first_air_date,
                  rating: s.vote_average,
                  media_type: "tv" as const,
                }))}
                onItemClick={goToTv}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default TrendingPage;