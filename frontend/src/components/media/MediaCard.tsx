import React, { useEffect, useState } from "react";
import { getBackdropUrl, getPosterUrl, tmdbApi } from "@/lib/tmdb";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Calendar, Star, X } from "lucide-react";

interface MediaCardProps {
  id: number;
  title: string;
  posterPath: string | null;
  rating: number;
  releaseDate?: string;
  backdropPath?: string | null;
  mediaType?: "movie" | "tv";
  onClick?: () => void;
  /** 0-100 — when set a progress bar is rendered at the bottom of the card */
  progressPct?: number;
  /** e.g. "S1 E4" — shown as a badge in the top-left corner */
  episodeLabel?: string;
  /** When provided an × dismiss button appears on hover */
  onRemove?: (e: React.MouseEvent) => void;
  variant?: "carousel" | "page";
}

export const MediaCard: React.FC<MediaCardProps> = ({
  id,
  title,
  posterPath,
  rating,
  releaseDate,
  backdropPath,
  mediaType = "movie",
  onClick,
  variant = "carousel",
  progressPct,
  episodeLabel,
  onRemove,
}) => {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const backdropUrl = getBackdropUrl(backdropPath ?? null, "medium");
  const fallbackPosterUrl = getPosterUrl(posterPath, "medium");
  const imageUrl = backdropUrl || fallbackPosterUrl;

  useEffect(() => {
    if (!isHovering || hasTriedFetch || !id || !isDesktop) return;

    const fetchTrailer = async () => {
      try {
        if (mediaType === "movie") {
          const videos = await tmdbApi.getMovieVideos(id);
          const trailer =
            videos.results.find(
              (v) => v.type === "Trailer" && v.site === "YouTube"
            ) || videos.results[0];
          if (trailer?.key) {
            setTrailerKey(trailer.key);
          }
        } else if (mediaType === "tv") {
          const videos = await tmdbApi.getTVVideos(id);
          const trailer =
            videos.results.find(
              (v) => v.type === "Trailer" && v.site === "YouTube"
            ) || videos.results[0];
          if (trailer?.key) {
            setTrailerKey(trailer.key);
          }
        }
      } catch {
        // ignore failure, keep static image
      } finally {
        setHasTriedFetch(true);
      }
    };

    void fetchTrailer();
  }, [hasTriedFetch, id, isHovering, isDesktop, mediaType]);

  const widthClasses =
    variant === "page"
      ? "w-full"
      : "w-[280px] sm:w-[340px] md:w-[460px]";

  return (
    <article
      className={`group relative flex-shrink-0 cursor-pointer ${widthClasses}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
    >
      <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden rounded-3xl bg-black shadow-[0_22px_60px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_30px_80px_rgba(0,0,0,1)]">
        {/* Backdrop image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            width={780}
            height={439}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm text-white/40">
            No artwork
          </div>
        )}

        {/* Trailer overlay on hover (no audio) - desktop only, hidden on mobile */}
        {isDesktop && isHovering && trailerKey && (
          <iframe
            className="absolute inset-0 h-full w-full rounded-3xl pointer-events-none"
            style={{ border: 'none', outline: 'none' }}
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&playsinline=1`}
            title={`${title} trailer`}
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
          />
        )}

        {/* Dark overlay & right-aligned title + badges, like the hero carousel */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end items-end p-4 sm:p-6 gap-2">
          {/* Title using the image title, mirroring the hero style */}
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] text-right line-clamp-1">
            {title}
          </h3>

          {/* Badges row at the bottom, starting from the right and flowing left */}
          <div
            className={`flex flex-row-reverse items-center gap-2 text-[11px] sm:text-xs transition-opacity duration-200 ${
              isDesktop && isHovering && trailerKey ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* Rating badge */}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
              <Star className="size-3.5 fill-[#ffd86b] text-[#ffd86b]" />
              <span className="text-[#ffd86b]">
                {Number.isFinite(rating) ? rating.toFixed(1) : "–"}
              </span>
            </span>

            {/* Year badge */}
            {releaseDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                <Calendar className="size-3.5 fill-[#dedede] text-[#dedede]" />
                <span className="text-[#dedede]">
                  {new Date(releaseDate).getFullYear()}
                </span>
              </span>
            )}

            {/* Type badge */}
            <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
              {mediaType === "tv" ? "TV" : "Movie"}
            </span>
          </div>
        </div>

        {/* Episode label (top-left) */}
        {episodeLabel && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-[11px] font-semibold text-white backdrop-blur-sm">
            {episodeLabel}
          </div>
        )}

        {/* Remove button (top-right, hover) */}
        {onRemove && (
          <button
            onClick={onRemove}
            className={`absolute top-3 right-3 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center transition-opacity duration-200 hover:bg-black/90 ${
              isHovering ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Remove"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        )}

        {/* Progress bar (bottom edge) */}
        {progressPct !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-white/10">
            <div
              className="h-full bg-white/80 rounded-full"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
        )}
      </div>
    </article>
  );
};
