import { useEffect, useRef, useState } from "react";
import { Play, ExternalLink, Star, Shuffle } from "lucide-react";
import { anilistApi, type AniListMedia } from "@/lib/anilist";

export default function AnimeHeroCarousel() {
  const [items, setItems] = useState<AniListMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const trending = await anilistApi.getTrendingAnime();
        setItems(trending);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
  }, []);

  const goToIndex = (nextIndex: number) => {
    if (items.length === 0 || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(((nextIndex % items.length) + items.length) % items.length);
      setTimeout(() => setIsTransitioning(false), 500);
    }, 200);
  };

  useEffect(() => {
    if (isPaused || items.length === 0) return;
    timerRef.current = window.setInterval(() => {
      goToIndex(currentIndex + 1);
    }, 8000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [isPaused, items.length, currentIndex]);

  const goRandom = () => {
    if (items.length <= 1) return;
    let rand = Math.floor(Math.random() * items.length);
    if (rand === currentIndex) {
      rand = (rand + 1) % items.length;
    }
    goToIndex(rand);
  };

  if (items.length === 0) {
    return (
      <section className="relative w-full overflow-hidden bg-[#070505] min-h-[55vh] md:min-h-[65vh] lg:min-h-[70vh] pt-16 sm:pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-white/0 to-white/5 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
      </section>
    );
  }

  const current = items[currentIndex];
  const title =
    current.title.english ||
    current.title.romaji ||
    current.title.native ||
    "Untitled";
  const year = current.seasonYear ?? null;
  const score = current.averageScore ?? null;
  const anilistUrl = `https://anilist.co/anime/${current.id}`;

  return (
    <section
      className="relative w-full overflow-hidden bg-[#070505] min-h-[55vh] md:min-h-[65vh] lg:min-h-[70vh] pt-16 sm:pt-20"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Featured anime carousel"
    >
      {/* Backdrop */}
      {items.map((media, index) => {
        const img =
          media.bannerImage ||
          media.coverImage.extraLarge ||
          media.coverImage.large ||
          "";
        return (
          <div
            key={media.id}
            className="absolute inset-0 transition-opacity duration-[800ms] ease-in-out"
            style={{
              opacity: index === currentIndex && !isTransitioning ? 1 : 0,
            }}
            aria-hidden={index !== currentIndex}
          >
            {img && (
              <img
                src={img}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            )}
          </div>
        );
      })}

      {/* Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      {/* Soft bottom fade so the backdrop flows into the rest of the page (match main hero) */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[60vh] md:h-[55vh] bg-gradient-to-t from-[#070505] via-[#070505]/85 to-transparent" />

      {/* Content */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col justify-end pb-16 md:pb-20 px-4 sm:px-6 md:px-16 lg:px-24 transition-opacity duration-500 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="mb-4 md:mb-5 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight text-balance drop-shadow-2xl">
            {title}
          </h1>
        </div>

        <p className="text-[#e5e5ec] text-sm md:text-base lg:text-lg max-w-2xl leading-relaxed mb-4 line-clamp-3 drop-shadow-lg">
          {current.format ?? "Anime"}{" "}
          {year ? `• ${year}` : ""}{" "}
          {current.episodes ? `• ${current.episodes} episodes` : ""}
        </p>

        <div className="flex items-center gap-3 text-xs sm:text-sm mb-4 flex-wrap">
          {score !== null && (
            <span className="flex items-center gap-1 text-[#ffd86b] font-semibold">
              <Star className="size-3.5 fill-[#ffd86b] text-[#ffd86b]" />
              {(score / 10).toFixed(1)}
            </span>
          )}
          {year && (
            <>
              <span className="text-[#5a5a6a]">{"/"}</span>
              <span className="text-[#c3c3d0]">{year}</span>
            </>
          )}
          <span className="text-[#5a5a6a]">{"/"}</span>
          <a href={anilistUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[#c3c3d0] text-xs md:text-sm hover:text-[#5a5a6a] active:scale-95 transition">
            View on AniList
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={anilistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-[#070505] font-semibold text-sm md:text-base shadow-lg hover:bg-white/90 active:scale-[0.97] transition"
          >
            <Play className="w-4 h-4 fill-black" />
            Play
          </a>

          <button
            type="button"
            onClick={goRandom}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/25 text-white text-xs md:text-sm hover:bg-white/20 active:scale-95 transition"
          >
            <Shuffle className="w-4 h-4" />
            Surprise me
          </button>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 md:bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {items.map((media, index) => (
          <button
            key={media.id}
            type="button"
            onClick={() => goToIndex(index)}
            className={`rounded-full transition-all duration-300 cursor-pointer ${
              index === currentIndex
                ? "w-4 h-1.5 md:w-6 md:h-2 bg-white"
                : "size-1.5 md:size-2 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}