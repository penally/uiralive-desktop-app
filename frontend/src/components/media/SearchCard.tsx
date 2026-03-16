import React, { useEffect, useState } from "react";
import { Calendar, Star } from "lucide-react";
import { getBackdropUrl, getPosterUrl, tmdbApi } from "@/lib/tmdb";

export interface SearchCardProps {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  rating: number;
  releaseDate?: string;
  mediaType: "movie" | "tv";
}

export const SearchCard: React.FC<SearchCardProps> = ({
  id,
  title,
  posterPath,
  backdropPath,
  rating,
  releaseDate,
  mediaType,
}) => {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);

  const backdropUrl = getBackdropUrl(backdropPath ?? null, "medium");
  const fallbackPosterUrl = getPosterUrl(posterPath, "small");
  const imageUrl = backdropUrl || fallbackPosterUrl;

  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  useEffect(() => {
    if (!isHovering || hasTriedFetch || !id) return;

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
        } else {
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
        // ignore failures
      } finally {
        setHasTriedFetch(true);
      }
    };

    void fetchTrailer();
  }, [hasTriedFetch, id, isHovering, mediaType]);

  return (
    <article
      className="group relative w-full cursor-pointer"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="relative h-40 sm:h-44 overflow-hidden rounded-2xl bg-black shadow-[0_16px_45px_rgba(0,0,0,0.9)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_24px_70px_rgba(0,0,0,1)]">
        {/* Backdrop / poster as full-card background */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/40">
            No artwork
          </div>
        )}

        {/* Small trailer preview on hover */}
        {isHovering && trailerKey && (
          <iframe
            className="absolute inset-0 h-full w-full pointer-events-none rounded-2xl"
            style={{ border: "none", outline: "none" }}
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&playsinline=1`}
            title={`${title} trailer`}
            allow="autoplay; encrypted-media"
          />
        )}

        {/* Gradient overlay similar to MediaCard, but scaled down */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent pointer-events-none" />

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-3.5">
          <div className="space-y-1">
            <h3 className="text-[13px] sm:text-sm font-semibold text-white line-clamp-2">
              {title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-white/65">
              {year && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{year}</span>
                </span>
              )}
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span className="uppercase tracking-[0.16em] text-[9px] sm:text-[10px] text-white/55">
                {mediaType === "tv" ? "TV" : "Movie"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-white/85 backdrop-blur-sm">
              <Star className="h-3 w-3 fill-[#ffd86b] text-[#ffd86b]" />
              <span>{Number.isFinite(rating) ? rating.toFixed(1) : "–"}</span>
            </div>
            <span className="text-white/45 group-hover:text-white/80 transition-colors">
              View details
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default SearchCard;

