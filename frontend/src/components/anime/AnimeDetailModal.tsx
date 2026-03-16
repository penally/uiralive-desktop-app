import React, { useEffect, useState } from "react";
import { X, Star, Calendar, Play, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { anilistApi, type AniListMedia } from "@/lib/anilist";

interface AnimeDetailModalProps {
  open: boolean;
  animeId: number | null;
  onClose: () => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  open,
  animeId,
  onClose,
}) => {
  const navigate = useNavigate();
  const [anime, setAnime] = useState<
    (AniListMedia & {
      description?: string | null;
      genres?: string[] | null;
      status?: string | null;
    }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !animeId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await anilistApi.getAnimeDetails(animeId);
        setAnime(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load anime");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open, animeId]);

  if (!open) return null;

  const handleClose = () => {
    setAnime(null);
    setError(null);
    onClose();
  };

  const handleWatch = () => {
    if (!animeId) return;
    navigate(`/anime/watch/${animeId}`);
  };

  const title =
    anime?.title.english ||
    anime?.title.romaji ||
    anime?.title.native ||
    "Untitled";
  const backdrop =
    anime?.bannerImage ||
    anime?.coverImage.extraLarge ||
    anime?.coverImage.large ||
    "";
  const year = anime?.seasonYear ?? null;
  const score = anime?.averageScore ?? null;
  const episodes = anime?.episodes ?? null;
  const description =
    anime?.description?.replace(/<\/?[^>]+(>|$)/g, "") ?? null;
  const anilistUrl = animeId ? `https://anilist.co/anime/${animeId}` : "#";

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] border-0 p-0 cursor-pointer transition-opacity duration-300"
        onClick={handleClose}
        aria-label="Close"
      />

      {/* Modal with blurred ambient background similar to MediaDetailModal */}
      <div className="fixed inset-0 z-[101] flex items-end md:items-center justify-center pt-8 md:pt-4 pb-2 md:pb-4 px-2 md:px-4 pointer-events-none">
        <div className="relative bg-black/95 backdrop-blur-2xl w-full max-w-6xl flex flex-col pointer-events-auto overflow-hidden rounded-t-2xl rounded-b-2xl md:rounded-3xl border border-white/10 shadow-[0_30px_120px_rgba(0,0,0,0.9)] h-[78vh] md:h-auto md:max-h-[98vh]">
          {/* Blurred background image */}
          {backdrop && (
            <div className="absolute inset-0 overflow-hidden rounded-2xl md:rounded-3xl">
              <img
                src={backdrop}
                alt=""
                aria-hidden="true"
                className="h-full w-full scale-110 object-cover blur-3xl"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/70" />
            </div>
          )}

          {loading && (
            <div className="relative z-10 flex items-center justify-center p-20">
              <div className="text-white/60 text-sm">Loading anime…</div>
            </div>
          )}

          {!loading && error && (
            <div className="relative z-10 flex flex-col items-center justify-center p-20 gap-4">
              <div className="text-red-400 text-center text-sm md:text-base">
                {error}
              </div>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && anime && (
            <div className="relative z-10 flex h-full min-h-0 flex-col">
              {/* Top: hero image + actions */}
              <div className="relative w-full h-[40vh] md:h-[55vh] min-h-[300px] md:min-h-[450px] overflow-hidden rounded-t-2xl md:rounded-t-3xl shrink-0">
                {backdrop ? (
                  <img
                    src={backdrop}
                    alt={title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    style={{
                      maskImage:
                        "linear-gradient(to bottom, black 0%, black 55%, rgba(0,0,0,0.6) 80%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, black 0%, black 55%, rgba(0,0,0,0.6) 80%, transparent 100%)",
                    }}
                  />
                ) : (
                  <>
                    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-black" />
                  </>
                )}

                {/* Close button - hidden on mobile, tap backdrop to close */}
                <button
                  onClick={handleClose}
                  className="hidden md:flex absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md border border-white/40 text-white transition-all duration-200 hover:scale-110 active:scale-95 items-center justify-center shadow-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Title + meta + primary actions */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8 pb-8 md:pb-12">
                  <div className="mb-4 md:mb-6">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white drop-shadow-2xl leading-tight">
                      {title}
                    </h2>
                  </div>

                  <div className="flex flex-col gap-3 md:gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={handleWatch}
                        className="inline-flex items-center gap-2 px-6 md:px-7 py-2.5 md:py-3 rounded-full bg-white text-black font-semibold text-sm md:text-base shadow-lg hover:bg-white/90 active:scale-[0.97] transition"
                      >
                        <Play className="w-4 h-4 md:w-5 md:h-5 fill-black" />
                        <span>Watch now</span>
                      </button>

                      <a
                        href={anilistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 px-4 items-center justify-center rounded-full bg-white/10 text-white text-xs md:text-sm hover:bg-white/20 active:scale-95 transition"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View on AniList
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                      {score !== null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                          <Star className="size-3.5 fill-[#ffd86b] text-[#ffd86b]" />
                          <span className="text-[#ffd86b]">
                            {(score / 10).toFixed(1)}
                          </span>
                        </span>
                      )}

                      {year && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                          <Calendar className="size-3.5" />
                          <span>{year}</span>
                        </span>
                      )}

                      {episodes && (
                        <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
                          {episodes} episodes
                        </span>
                      )}

                      {anime.format && (
                        <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
                          {anime.format}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body: synopsis + side meta */}
              <div className="relative flex-1 min-h-0 overscroll-contain overflow-y-auto overflow-x-hidden pr-2" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
                <div className="p-6 md:p-8 space-y-8 md:space-y-10">
                  <section className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">
                    <div className="md:w-2/3">
                      <h3 className="text-white/60 text-xs md:text-sm font-medium uppercase tracking-wider mb-3">
                        Synopsis
                      </h3>
                      <p className="text-white/85 text-sm md:text-base leading-relaxed">
                        {description || "No description available."}
                      </p>
                    </div>

                    <div className="text-xs md:text-sm text-white/70 space-y-3 md:w-1/3">
                      {anime.genres && anime.genres.length > 0 && (
                        <div>
                          <p className="text-white/60 mb-1.5">Genres</p>
                          <div className="flex flex-wrap gap-1.5">
                            {anime.genres.map((g) => (
                              <span
                                key={g}
                                className="px-2 py-1 rounded-full bg-white/10 text-white/85"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {anime.status && (
                        <div>
                          <p className="text-white/60 mb-1.5">Status</p>
                          <div className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-white/85">
                            {anime.status}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AnimeDetailModal;