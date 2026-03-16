"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AddToWatchlist } from "@/components/AddToWatchlist";
import {
  getTrending,
  getItemDetails,
  getImageUrl,
  getBackdropUrl,
  getDisplayTitle,
  getYear,
  type TMDBItem,
  type TMDBDetailItem,
} from "@/lib/tmdb";
import {
  Star,
  ExternalLink,
  Play,
  Info,
  Shuffle,
} from "lucide-react";

export default function HeroCarousel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<TMDBItem[]>([]);
  const [details, setDetails] = useState<Record<number, TMDBDetailItem>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<number, string | null>>({});

  // Fetch trending items
  useEffect(() => {
    getTrending().then((data: TMDBItem[]) => {
      setItems(data);
      // Preload first image
      if (data.length > 0) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = getBackdropUrl(data[0].backdrop_path, "original") || "";
        img.onload = () =>
          setImageLoaded((prev) => ({ ...prev, [data[0].id]: true }));
      }
    });
  }, []);

  // Fetch details for current item
  useEffect(() => {
    if (items.length === 0) return;
    const item = items[currentIndex];
    if (!details[item.id]) {
      getItemDetails(item.id, item.media_type).then((detail: TMDBDetailItem) => {
        setDetails((prev) => ({ ...prev, [item.id]: detail }));
        // Extract logo
        const logo = detail.images?.logos?.find(
          (l: { iso_639_1: string | null }) =>
            l.iso_639_1 === "en" || l.iso_639_1 === null
        );
        if (logo) {
          setLogoUrls((prev) => ({
            ...prev,
            [item.id]: getImageUrl(logo.file_path, "w500"),
          }));
        } else {
          setLogoUrls((prev) => ({ ...prev, [item.id]: null }));
        }
      });
    }
  }, [items, currentIndex, details]);

  const goToSlide = useCallback(
    (indexOrFn: number | ((prev: number) => number)) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next =
            typeof indexOrFn === "function" ? indexOrFn(prev) : indexOrFn;
          return next;
        });
        setTimeout(() => setIsTransitioning(false), 600);
      }, 400);
    },
    [isTransitioning]
  );

  // Preload next image
  useEffect(() => {
    if (items.length === 0) return;
    const nextIdx = (currentIndex + 1) % items.length;
    const nextItem = items[nextIdx];
    if (!imageLoaded[nextItem.id]) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = getBackdropUrl(nextItem.backdrop_path, "original") || "";
      img.onload = () =>
        setImageLoaded((prev) => ({ ...prev, [nextItem.id]: true }));
    }
  }, [currentIndex, items, imageLoaded]);

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || items.length === 0) return;
    timerRef.current = window.setInterval(() => {
      goToSlide((prev: number) => (prev + 1) % items.length);
    }, 8000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [isPaused, items.length, goToSlide]);

  const goRandom = useCallback(() => {
    if (items.length <= 1) return;
    let rand: number;
    do {
      rand = Math.floor(Math.random() * items.length);
    } while (rand === currentIndex);
    goToSlide(rand);
  }, [items.length, currentIndex, goToSlide]);

  if (items.length === 0) {
    // Hero skeleton while we fetch initial data - match content layout exactly to avoid 1px shift
    return (
      <section className="relative w-full overflow-hidden bg-[#070505] min-h-[55vh] md:min-h-[65vh] lg:min-h-[70vh] pt-16 sm:pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-white/0 to-white/5 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end pb-16 md:pb-20 px-4 sm:px-6 md:px-16 lg:px-24 box-border">
          <div className="mb-4 md:mb-5 max-w-3xl space-y-3">
            <div className="h-8 sm:h-10 w-2/3 rounded-full bg-white/15 shrink-0" />
            <div className="h-3 w-3/4 rounded-full bg-white/10 shrink-0" />
            <div className="h-3 w-2/3 rounded-full bg-white/10 shrink-0" />
          </div>
          <div className="flex flex-col gap-3 max-w-md">
            <div className="h-3 w-32 rounded-full bg-white/10 shrink-0" />
            <div className="flex gap-3">
              <div className="h-10 w-28 rounded-full bg-white/20 shrink-0" />
              <div className="h-10 flex-1 min-w-0 rounded-full bg-white/10 shrink-0" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const current = items[currentIndex] ?? null;
  const detail = current ? details[current.id] : undefined;
  const logoUrl = current ? logoUrls[current.id] : null;
  const title = current ? getDisplayTitle(current) : "";
  const year = current ? getYear(current) : null;
  const rating = current?.vote_average?.toFixed(1);
  const mediaLabel = current
    ? current.media_type === "movie"
      ? "Movie"
      : "TV Series"
    : "";

  return (
    <section
      className="relative w-full overflow-hidden bg-[#070505] min-h-[55vh] md:min-h-[65vh] lg:min-h-[70vh] pt-16 sm:pt-20"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Featured content carousel"
    >
      {/* Backdrop images - stacked for crossfade, using high-res backdrops */}
      {items.map((item, index) => {
        const url = getBackdropUrl(item.backdrop_path, "original");
        return (
          <div
            key={item.id}
            className="absolute inset-0 transition-opacity duration-[800ms] ease-in-out"
            style={{ opacity: index === currentIndex && !isTransitioning ? 1 : 0 }}
            aria-hidden={index !== currentIndex}
          >
            {url && (
              <img
                src={url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-center"
                loading={index <= 1 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={index === 0 ? "high" : "auto"}
              />
            )}
          </div>
        );
      })}

      {/* Gradient overlays for blending into page */}
      {/* Soft global darkening so the image stays bright but text & nav remain readable */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />
      {/* Stronger left-side vignette so the sidebar and hero text stay visible even on light backdrops */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
      {/* Soft bottom fade so the backdrop flows into the rest of the page */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[60vh] md:h-[55vh] bg-gradient-to-t from-[#070505] via-[#070505]/85 to-transparent" />

      {/* Content overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col justify-end pb-16 md:pb-20 px-4 sm:px-6 md:px-16 lg:px-24 transition-opacity duration-500 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Logo or Title */}
        <div className="mb-4 md:mb-5 max-w-3xl">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={title}
              className="max-h-28 md:max-h-36 lg:max-h-44 w-auto object-contain drop-shadow-2xl"
            />
          ) : (
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight text-balance drop-shadow-2xl">
              {title}
            </h1>
          )}
        </div>

        {/* Description */}
        <p className="text-[#e5e5ec] text-sm md:text-base lg:text-lg max-w-2xl leading-relaxed mb-3 md:mb-4 line-clamp-3 drop-shadow-lg">
          {detail?.tagline
            ? `${detail.tagline} - ${current?.overview}`
            : current?.overview}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-xs sm:text-sm mb-4 md:mb-6 flex-wrap">
          <span className="flex items-center gap-1 text-[#ffd86b] font-semibold">
            <Star className="size-3.5 fill-[#ffd86b] text-[#ffd86b]" />
            {rating}
          </span>
          {year && (
            <>
              <span className="text-[#5a5a6a]">{"/"}</span>
              <span className="text-[#c3c3d0]">{year}</span>
            </>
          )}
          <span className="text-[#5a5a6a]">{"/"}</span>
          <span className="text-[#c3c3d0]">{mediaLabel}</span>
          {detail?.homepage && (
            <>
              <span className="text-[#5a5a6a]">{"/"}</span>
              <a
                href={detail.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#c3c3d0] hover:text-[#5a5a6a] transition-colors flex items-center gap-1"
              >
                Homepage
                <ExternalLink className="size-3" />
              </a>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap [&_button]:cursor-pointer">
          {/* Primary Play button with subtle tooltip */}
          <div className="relative group">
            <button
              onClick={() => {
                if (!current) return;
                if (current.media_type === "movie") {
                  navigate(`/movie/watch/${current.id}`);
                } else {
                  navigate(`/tv/watch/${current.id}/1/1`);
                }
              }}
              className="flex items-center gap-2.5 bg-white text-[#070505] px-6 py-2.5 rounded-full font-semibold text-sm md:text-base hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md"
            >
              <Play className="size-4 fill-[#0a0a0f]" />
              Play
            </button>
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <div className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-[#070505] shadow-lg relative">
                <span>Play</span>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/95 rotate-45" />
              </div>
            </div>
          </div>

          {/* Secondary pill with Save + Info + Surprise */}
          <div className="flex items-center rounded-full bg-white/10 bg-clip-padding backdrop-blur-md border border-white/15 text-white overflow-hidden">
            <AddToWatchlist
              tmdbId={current.id}
              mediaType={current.media_type}
              title={title}
              year={year}
              posterPath={current.poster_path}
              className="px-4 py-2 text-xs sm:text-sm md:text-base font-medium hover:bg-white/15 transition-colors cursor-pointer"
              variant="button"
              showLabel={true}
            />
            <div className="h-6 w-px bg-white/20" />
            <button
              onClick={() => {
                if (!current) return;
                navigate(current.media_type === "movie" ? `/movie/${current.id}` : `/tv/${current.id}`, {
                  state: { backgroundLocation: location },
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm md:text-base font-medium hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Info className="size-4" />
              <span className="hidden sm:inline">Info</span>
            </button>
            <div className="h-6 w-px bg-white/20" />
          <button
            onClick={goRandom}
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm md:text-base font-medium hover:bg-white/15 transition-colors cursor-pointer"
          >
            <Shuffle className="size-4" />
              <span className="hidden sm:inline">Surprise</span>
          </button>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-8 md:bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => goToSlide(index)}
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