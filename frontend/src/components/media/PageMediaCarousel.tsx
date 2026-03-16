import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { HorizontalScrollArea } from "./HorizontalScrollArea";

export interface PageMediaCarouselItem {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  rating?: number;
  media_type?: "movie" | "tv";
}

interface PageMediaCarouselProps {
  title: string;
  items: PageMediaCarouselItem[];
  onItemClick?: (item: PageMediaCarouselItem) => void;
}

export const PageMediaCarousel: React.FC<PageMediaCarouselProps> = ({
  title,
  items,
  onItemClick,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (direction: "left" | "right") => {
    if (!trackRef.current) return;
    const { clientWidth } = trackRef.current;
    const delta = direction === "left" ? -clientWidth * 0.8 : clientWidth * 0.8;
    trackRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="relative w-full">
      <div className="mb-3 flex items-center justify-between pr-4 sm:pr-8">
        <div className="flex items-center gap-2">
          <span className="h-6 w-1.5 rounded-full bg-white" />
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 pr-1">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="flex h-32 items-center justify-center text-sm text-white/60 bg-black/20 rounded-2xl">
          No media found.
        </div>
      )}

      {items.length > 0 && (
        <div className="relative">
          {/* Right fade gradient — signals more content */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-black to-transparent" />

          <HorizontalScrollArea
            viewportRef={trackRef}
            className="relative flex gap-3 pb-3 pt-1 overflow-x-auto w-full [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <MediaCard
                key={item.id}
                id={item.id}
                title={item.title || "Untitled"}
                posterPath={item.poster_path}
                backdropPath={item.backdrop_path}
                rating={item.rating ?? 0}
                releaseDate={item.release_date}
                mediaType={item.media_type ?? "movie"}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
            {/* Spacer so last card isn't hidden behind the fade */}
            <div className="shrink-0 w-16" />
          </HorizontalScrollArea>
        </div>
      )}
    </div>
  );
};