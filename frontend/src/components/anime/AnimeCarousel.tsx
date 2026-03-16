import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AnimeCard from "./AnimeCard";
import type { AniListMedia } from "@/lib/anilist";
import { HorizontalScrollArea } from "@/components/media/HorizontalScrollArea";

interface AnimeCarouselProps {
  title: string;
  items: AniListMedia[];
  onItemClick?: (media: AniListMedia) => void;
}

export const AnimeCarousel: React.FC<AnimeCarouselProps> = ({
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
      <div className="mb-3 flex items-center justify-between">
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
          No anime found.
        </div>
      )}

      {items.length > 0 && (
        <HorizontalScrollArea
          viewportRef={trackRef}
          className="relative flex gap-3 pb-3 pt-1 pr-2 sm:pr-4"
        >
          {items.map((media) => (
            <AnimeCard
              key={media.id}
              media={media}
              onClick={onItemClick ? () => onItemClick(media) : undefined}
            />
          ))}
        </HorizontalScrollArea>
      )}
    </div>
  );
};

export default AnimeCarousel;

