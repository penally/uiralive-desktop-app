import React from "react";
import { Calendar, Star } from "lucide-react";
import type { AniListMedia } from "@/lib/anilist";

interface AnimeCardProps {
  media: AniListMedia;
  onClick?: () => void;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({ media, onClick }) => {
  const title =
    media.title.english ||
    media.title.romaji ||
    media.title.native ||
    "Untitled";
  const imageUrl = media.bannerImage || media.coverImage.extraLarge || media.coverImage.large || "";
  const year = media.seasonYear ?? null;
  const score = media.averageScore ?? null;

  return (
    <article
      className="group relative flex-shrink-0 w-[280px] sm:w-[340px] md:w-[400px] cursor-pointer"
      onClick={onClick}
    >
      <div className="relative h-44 sm:h-52 md:h-56 overflow-hidden rounded-3xl bg-black shadow-[0_22px_60px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_30px_80px_rgba(0,0,0,1)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm text-white/40">
            No artwork
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end items-end p-4 sm:p-5 gap-2">
          <h3 className="text-xl sm:text-2xl font-semibold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] text-right line-clamp-1">
            {title}
          </h3>
          <div className="flex flex-row-reverse items-center gap-2 text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
              <Star className="size-3.5 fill-[#ffd86b] text-[#ffd86b]" />
              <span className="text-[#ffd86b]">
                {score !== null ? (score / 10).toFixed(1) : "–"}
              </span>
            </span>
            {year && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                <Calendar className="size-3.5" />
                <span>{year}</span>
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
              Anime
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default AnimeCard;

