import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChevronDown, Search as SearchIcon, Star } from "lucide-react";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  tmdbApi,
  type TMDBGenre,
  type TMDBMultiSearchResult,
} from "@/lib/tmdb";
import { anilistApi, type AniListMedia } from "@/lib/anilist";
import SearchCard from "@/components/media/SearchCard";

type Category = "all" | "movies" | "tvshows" | "anime";
type SortBy = "popularity.desc" | "vote_average.desc";

const years = Array.from({ length: 50 }, (_, i) => `${new Date().getFullYear() - i}`);

// Map genre IDs between movie and TV (different IDs for same concept)
const GENRE_CROSS_MAP: Record<number, { movies?: string; tv?: string }> = {
  28: { tv: "10759" },
  12: { tv: "10759" },
  10759: { movies: "28|12" },
  878: { tv: "10765" },
  14: { tv: "10765" },
  10765: { movies: "878|14" },
};

function resolveGenreForApi(
  genreId: number,
  forMovies: boolean,
  movieIds: Set<number>,
  tvIds: Set<number>
): string {
  const isMovie = movieIds.has(genreId);
  const isTv = tvIds.has(genreId);
  if (forMovies && isMovie) return String(genreId);
  if (!forMovies && isTv) return String(genreId);
  const map = GENRE_CROSS_MAP[genreId];
  if (map) {
    const val = forMovies ? map.movies : map.tv;
    if (val) return val;
  }
  return String(genreId);
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  value,
  onChange,
  options,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/15 px-3 py-1.5 text-xs md:text-sm text-white/80 hover:bg-white/10"
      >
        <span className="hidden sm:inline text-white/50">{label}</span>
        <span className="font-medium">{selected.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/50 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mt-2 w-44 max-h-64 overflow-y-auto rounded-xl bg-black/95 border border-white/10 shadow-xl z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs md:text-sm hover:bg-white/10 ${opt.value === value ? "bg-white/10" : "text-white/80"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SearchPage: React.FC = () => {
  usePageTitle("Search • Uira.Live");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const query = searchParams.get("q") ?? "";
  const category = (searchParams.get("category") as Category) || "all";
  const genre = searchParams.get("genre") ?? "any";
  const year = searchParams.get("year") ?? "any";
  const sortParam = searchParams.get("sort");
  const sort: SortBy = sortParam === "vote_average.desc" ? "vote_average.desc" : "popularity.desc";

  const [genres, setGenres] = useState<TMDBGenre[]>([]);
  const [movieGenreIds, setMovieGenreIds] = useState<Set<number>>(new Set());
  const [tvGenreIds, setTvGenreIds] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<TMDBMultiSearchResult[]>([]);
  const [animeResults, setAnimeResults] = useState<AniListMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState(query);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (queryInput !== query) updateParams({ q: queryInput });
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === "" || v === "all" || v === "any" || v === "popularity.desc") next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  };

  // Load genres once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, t] = await Promise.all([
          tmdbApi.getMovieGenres(),
          tmdbApi.getTVGenres(),
        ]);
        if (cancelled) return;
        const movieList = m.genres ?? [];
        const tvList = t.genres ?? [];
        const seen = new Map<number, TMDBGenre>();
        [...movieList, ...tvList].forEach((g) => seen.set(g.id, g));
        setGenres(Array.from(seen.values()));
        setMovieGenreIds(new Set(movieList.map((g) => g.id)));
        setTvGenreIds(new Set(tvList.map((g) => g.id)));
      } catch (e) {
        if (!cancelled) console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Single fetch effect - runs when params change
  useEffect(() => {
    const trimmed = query.trim();

    if (category === "anime") {
      if (!trimmed) {
        setResults([]);
        setAnimeResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      anilistApi
        .searchAnime(trimmed)
        .then((data) => {
          setAnimeResults(data);
          setResults([]);
        })
        .catch((e) => {
          console.error(e);
          setError("Anime search failed.");
        })
        .finally(() => setLoading(false));
      return;
    }

    if (!trimmed && genre === "any" && category === "all" && year === "any") {
      setResults([]);
      setAnimeResults([]);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setLoading(true);
    setError(null);

    const movieSort = sort;
    const tvSort = sort;

    const run = async () => {
      try {
        let items: TMDBMultiSearchResult[] = [];

        if (trimmed) {
          const res = await tmdbApi.searchMulti(trimmed, 1);
          items = (res.results ?? []).filter(
            (r) => r.media_type === "movie" || r.media_type === "tv"
          ) as TMDBMultiSearchResult[];
        } else {
          const genreId = genre !== "any" ? Number(genre) : null;
          const yearNum = year !== "any" ? Number(year) : null;

          if (category === "movies") {
            const params: Record<string, string | number> = { sort_by: movieSort };
            if (genreId !== null) {
              params.with_genres = resolveGenreForApi(genreId, true, movieGenreIds, tvGenreIds);
            }
            if (yearNum && !Number.isNaN(yearNum)) params.primary_release_year = yearNum;
            const res = await tmdbApi.discoverMovies(params);
            items = (res.results ?? []).map((m) => ({
              ...m,
              media_type: "movie" as const,
              title: m.title,
            }));
          } else if (category === "tvshows") {
            const params: Record<string, string | number> = { sort_by: tvSort };
            if (genreId !== null) {
              params.with_genres = resolveGenreForApi(genreId, false, movieGenreIds, tvGenreIds);
            }
            if (yearNum && !Number.isNaN(yearNum)) params.first_air_date_year = yearNum;
            const res = await tmdbApi.discoverTV(params);
            items = (res.results ?? []).map((t) => ({
              ...t,
              media_type: "tv" as const,
              name: t.name,
            }));
          } else {
            const movieParams: Record<string, string | number> = { sort_by: movieSort };
            const tvParams: Record<string, string | number> = { sort_by: tvSort };
            if (genreId !== null) {
              const mg = resolveGenreForApi(genreId, true, movieGenreIds, tvGenreIds);
              const tg = resolveGenreForApi(genreId, false, movieGenreIds, tvGenreIds);
              if (mg) movieParams.with_genres = mg;
              if (tg) tvParams.with_genres = tg;
            }
            if (yearNum && !Number.isNaN(yearNum)) {
              movieParams.primary_release_year = yearNum;
              tvParams.first_air_date_year = yearNum;
            }
            const [movies, tv] = await Promise.all([
              (movieParams.with_genres || yearNum) ? tmdbApi.discoverMovies(movieParams) : null,
              (tvParams.with_genres || yearNum) ? tmdbApi.discoverTV(tvParams) : null,
            ]);
            if (movies) {
              items = [
                ...items,
                ...(movies.results ?? []).map((m) => ({
                  ...m,
                  media_type: "movie" as const,
                  title: m.title,
                })),
              ];
            }
            if (tv) {
              items = [
                ...items,
                ...(tv.results ?? []).map((t) => ({
                  ...t,
                  media_type: "tv" as const,
                  name: t.name,
                })),
              ];
            }
          }
        }

        if (signal.aborted) return;
        setResults(items.slice(0, 40));
        setAnimeResults([]);
      } catch (e) {
        if (signal.aborted) return;
        console.error(e);
        setError("Search failed. Please try again.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => abortRef.current?.abort();
  }, [query, category, genre, year, sort, movieGenreIds.size, tvGenreIds.size]);

  const genreOptions = useMemo(
    () => [ { value: "any", label: "Any genre" }, ...genres.map((g) => ({ value: String(g.id), label: g.name })) ].sort((a, b) => a.label.localeCompare(b.label)),
    [genres]
  );

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex">
      <SidebarNav />
      <main className="flex-1 sm:ml-28 px-4 sm:px-8 pt-10 pb-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="space-y-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">Search</h1>
            <p className="text-sm text-white/60 max-w-xl">Find movies and TV shows across genres, years, and ratings.</p>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search for a title, person, or genre..."
                className="w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 py-3.5 text-sm md:text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            </div>
          </header>

          <section className="flex flex-wrap gap-3 items-center justify-between">
            <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1">
              {(["all", "movies", "tvshows", "anime"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateParams({ category: id })}
                  className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${
                    category === id ? "bg-white text-black" : "text-white/70 hover:text-white"
                  }`}
                >
                  {id === "all" ? "All" : id === "movies" ? "Movies" : id === "tvshows" ? "TV Shows" : "Anime"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <FilterSelect
                label="Genre"
                value={genre}
                onChange={(v) => updateParams({ genre: v })}
                options={genreOptions}
              />
              <FilterSelect
                label="Year"
                value={year}
                onChange={(v) => updateParams({ year: v })}
                options={[{ value: "any", label: "Any year" }, ...years.map((y) => ({ value: y, label: y }))]}
              />
              <FilterSelect
                label="Sort"
                value={sort}
                onChange={(v) => updateParams({ sort: v })}
                options={[
                  { value: "popularity.desc", label: "Most popular" },
                  { value: "vote_average.desc", label: "Top rated" },
                ]}
              />
            </div>
          </section>

          <section>
            {loading && (
              <div className="py-16 text-center text-sm text-white/60">Searching…</div>
            )}
            {!loading && error && (
              <div className="py-16 text-center text-sm text-red-400">{error}</div>
            )}
            {!loading && !error && category !== "anime" && results.length === 0 && query.trim() && (
              <div className="py-16 text-center text-sm text-white/50">No results found. Try a different title or filter.</div>
            )}
            {!loading && !error && category !== "anime" && results.length === 0 && !query.trim() && (genre !== "any" || year !== "any" || category !== "all") && (
              <div className="py-16 text-center text-sm text-white/50">No results for this combination. Try different filters.</div>
            )}
            {!loading && !error && category !== "anime" && results.length > 0 && (
              <div className="space-y-4">
                <div className="text-xs text-white/45">
                  Showing {results.length} {category === "movies" ? "movies" : category === "tvshows" ? "TV shows" : "titles"}
                </div>
                <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((item) => {
                    if (item.media_type !== "movie" && item.media_type !== "tv") return null;
                    const title = item.title ?? item.name ?? "Untitled";
                    const releaseDate = item.release_date ?? item.first_air_date;
                    return (
                      <button
                        key={`${item.media_type}-${item.id}`}
                        type="button"
                        onClick={() =>
                          navigate(`/${item.media_type}/${item.id}`, {
                            state: { backgroundLocation: location },
                          })
                        }
                        className="text-left cursor-pointer h-full group"
                      >
                        <SearchCard
                          id={item.id}
                          title={title}
                          posterPath={item.poster_path}
                          backdropPath={item.backdrop_path}
                          rating={item.vote_average ?? 0}
                          releaseDate={releaseDate}
                          mediaType={item.media_type}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!loading && !error && category === "anime" && animeResults.length === 0 && query.trim() && (
              <div className="py-16 text-center text-sm text-white/50">No anime found. Try a different title.</div>
            )}
            {!loading && !error && category === "anime" && animeResults.length > 0 && (
              <div className="space-y-4">
                <div className="text-xs text-white/45">Showing {animeResults.length} anime titles</div>
                <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {animeResults.map((media) => {
                    const title = media.title.english || media.title.romaji || media.title.native || "Untitled";
                    const yr = media.seasonYear ?? null;
                    const score = media.averageScore ?? null;
                    return (
                      <article
                        key={media.id}
                        className="group relative w-full cursor-pointer rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,0.9)] hover:-translate-y-1 transition-transform"
                      >
                        <div className="relative h-40 sm:h-44">
                          {(media.bannerImage || media.coverImage?.large) ? (
                            <img
                              src={media.bannerImage || media.coverImage!.large || ""}
                              alt={title}
                              className="absolute inset-0 h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/40">No artwork</div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
                          <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-3.5">
                            <div>
                              <h3 className="text-[13px] sm:text-sm font-semibold text-white line-clamp-2">{title}</h3>
                              <div className="flex items-center gap-2 text-[10px] text-white/65 mt-1">
                                {yr && <span><Calendar className="inline h-3 w-3" /> {yr}</span>}
                                <span className="uppercase tracking-wider text-white/55">Anime</span>
                              </div>
                            </div>
                            <div className="inline-flex gap-1 rounded-full bg-white/10 px-2 py-1 text-white/85 w-fit">
                              <Star className="h-3 w-3 fill-[#ffd86b] text-[#ffd86b]" />
                              <span>{score != null ? (score / 10).toFixed(1) : "–"}</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
