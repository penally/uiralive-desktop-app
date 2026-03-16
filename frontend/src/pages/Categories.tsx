import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { tmdbApi, type TMDBGenre } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";

const CategoriesPage: React.FC = () => {
  usePageTitle("Categories • Uira.Live");
  const navigate = useNavigate();

  const [movieGenres, setMovieGenres] = useState<TMDBGenre[]>([]);
  const [tvGenres, setTvGenres] = useState<TMDBGenre[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [movies, tv] = await Promise.all([
          tmdbApi.getMovieGenres(),
          tmdbApi.getTVGenres(),
        ]);
        setMovieGenres(movies.genres ?? []);
        setTvGenres(tv.genres ?? []);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
  }, []);

  const goToGenre = (kind: "movies" | "tvshows", genre: TMDBGenre) => {
    const params = new URLSearchParams();
    params.set("category", kind);
    params.set("genre", String(genre.id));
    navigate(`/search?${params.toString()}`);
  };

  const renderGenreGrid = (kind: "movies" | "tvshows", genres: TMDBGenre[]) => (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {genres.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => goToGenre(kind, g)}
          className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-left hover:bg-white/10 hover:border-white/25 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm sm:text-base font-medium text-white">
              {g.name}
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-white/50">
              {kind === "movies" ? "Movie" : "TV"}
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/2 bg-white/40 group-hover:w-full group-hover:bg-white transition-all" />
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex">
      <SidebarNav />
      <main className="flex-1 sm:ml-28 px-4 sm:px-8 pt-10 pb-12 space-y-10">
        <header className="max-w-7xl mx-auto space-y-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">
            Browse by category
          </h1>
          <p className="text-sm text-white/60 max-w-xl">
            Jump straight into genres for movies and TV shows. Tap a card to
            search within that category.
          </p>
        </header>

        <section className="max-w-7xl mx-auto space-y-4">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-[0.2em]">
            Movies
          </h2>
          {renderGenreGrid("movies", movieGenres)}
        </section>

        <section className="max-w-7xl mx-auto space-y-4">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-[0.2em]">
            TV Shows
          </h2>
          {renderGenreGrid("tvshows", tvGenres)}
        </section>
      </main>
    </div>
  );
};

export default CategoriesPage;

