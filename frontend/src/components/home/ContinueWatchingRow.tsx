import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getContinueWatchingItems, removeContinueWatchingItem, type ContinueWatchingItem } from "@/components/player/lib/storage";
import { fetchAllProgress, deleteProgressFromBackend } from "@/lib/api/backend";
import { useAuth } from "@/contexts/AuthContext";
import { HorizontalScrollArea } from "@/components/media/HorizontalScrollArea";
import { MediaCard } from "@/components/media/MediaCard";

const MIN_PROGRESS_SECONDS = 10;

interface MergedItem extends ContinueWatchingItem {
  progressPct: number;
}

function mergeItems(local: ContinueWatchingItem[], backend: any[]): MergedItem[] {
  const map = new Map<string, ContinueWatchingItem>();

  backend.forEach((b) => {
    const key = b.type === "MOVIE"
      ? `movie-${b.tmdbId}`
      : `tv-${b.tmdbId}-${b.season ?? 0}-${b.episode ?? 0}`;
    map.set(key, {
      tmdbId: b.tmdbId,
      type: b.type === "MOVIE" ? "movie" : "tv",
      season: b.season ?? undefined,
      episode: b.episode ?? undefined,
      progress: b.progress,
      duration: b.duration,
      lastWatched: new Date(b.updatedAt).getTime(),
      title: b.title ?? undefined,
      name: b.title ?? undefined,
      poster_path: b.posterPath ?? null,
      backdrop_path: b.backdropPath ?? null,
      vote_average: b.voteAverage ?? undefined,
    });
  });

  local.forEach((l) => {
    const key = l.type === "movie"
      ? `movie-${l.tmdbId}`
      : `tv-${l.tmdbId}-${l.season ?? 0}-${l.episode ?? 0}`;
    if (!map.has(key)) map.set(key, l);
  });

  return Array.from(map.values())
    .filter((i) => i.progress >= MIN_PROGRESS_SECONDS && i.duration > 0)
    .sort((a, b) => b.lastWatched - a.lastWatched)
    .map((i) => ({
      ...i,
      progressPct: Math.min(100, Math.round((i.progress / i.duration) * 100)),
    }));
}

export const ContinueWatchingRow: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<MergedItem[]>([]);

  const load = useCallback(async () => {
    const local = getContinueWatchingItems();
    let backend: any[] = [];
    if (isAuthenticated) {
      try { backend = await fetchAllProgress(); } catch { /* silent */ }
    }
    setItems(mergeItems(local, backend));
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const handleRemove = (item: MergedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove from localStorage immediately
    removeContinueWatchingItem(item.tmdbId, item.season, item.episode);
    // Remove from backend (fire-and-forget, only if logged in)
    if (isAuthenticated) {
      void deleteProgressFromBackend(item.tmdbId, item.type, item.season, item.episode);
    }
    setItems((prev) => prev.filter((i) => i !== item));
  };

  const handlePlay = (item: MergedItem) => {
    if (item.type === "movie") {
      navigate(`/movie/watch/${item.tmdbId}`);
    } else {
      navigate(`/tv/watch/${item.tmdbId}/${item.season}/${item.episode}`);
    }
  };

  const scroll = (dir: "left" | "right") => {
    if (!trackRef.current) return;
    const delta = dir === "left" ? -trackRef.current.clientWidth * 0.8 : trackRef.current.clientWidth * 0.8;
    trackRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <section aria-label="Continue watching">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-6 w-1.5 rounded-full bg-white" />
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">
            Continue Watching
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 pr-1">
          <button
            onClick={() => scroll("left")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <HorizontalScrollArea
        viewportRef={trackRef}
        className="flex gap-3 pb-3 pt-1 pr-2 sm:pr-4"
      >
        {items.map((item) => {
          const key = item.type === "movie"
            ? `movie-${item.tmdbId}`
            : `tv-${item.tmdbId}-${item.season}-${item.episode}`;

          const episodeLabel = item.type === "tv" && item.season != null && item.episode != null
            ? `S${item.season} E${item.episode}`
            : undefined;

          return (
            <MediaCard
              key={key}
              id={item.tmdbId}
              title={item.title || item.name || "Unknown"}
              posterPath={item.poster_path ?? null}
              backdropPath={item.backdrop_path ?? null}
              rating={item.vote_average ?? 0}
              releaseDate={item.release_date || item.first_air_date}
              mediaType={item.type}
              onClick={() => handlePlay(item)}
              progressPct={item.progressPct}
              episodeLabel={episodeLabel}
              onRemove={(e) => handleRemove(item, e)}
            />
          );
        })}
      </HorizontalScrollArea>
    </section>
  );
};
