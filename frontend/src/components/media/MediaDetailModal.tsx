import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Clock, Volume2, VolumeX, Video, ChevronDown, Star, Calendar, Plus, Lock, MessageCircle, Send, Trash2, Shield, Crown } from "lucide-react";
import { useNavigate, useLocation, type Location } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  tmdbApi,
  getBackdropUrl,
  type TMDBGenre,
  type TMDBMovie,
  type TMDBSeries,
  type TMDBProductionCompany,
} from "@/lib/tmdb";
import { checkContentLocked, checkSeasonLocked, fetchComments, postComment, deleteComment, fetchSimilar, type CommentItem, type SimilarItem } from "@/lib/api/backend";
import { getPreferredLanguage } from "@/components/player/lib/storage";
import { MediaCarousel, type MediaCarouselItem } from "@/components/media/MediaCarousel";

interface MediaDetailModalProps {
  open: boolean;
  mediaId: number | null;
  mediaType?: "movie" | "tv";
  onClose: () => void;
}

type MediaType = "movie" | "tv";

interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  still_path: string | null;
  runtime: number;
  air_date: string;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  open,
  mediaId,
  mediaType = "movie",
  onClose,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [media, setMedia] = useState<
    | (TMDBMovie & {
        genres?: TMDBGenre[];
        tagline?: string;
        homepage?: string;
        images?: { logos?: { file_path: string; iso_639_1: string | null }[] };
        runtime?: number;
        production_companies?: TMDBProductionCompany[];
      })
    | (TMDBSeries & {
        genres?: TMDBGenre[];
        tagline?: string;
        homepage?: string;
        images?: { logos?: { file_path: string; iso_639_1: string | null }[] };
        number_of_seasons?: number;
        seasons?: { id?: number; season_number: number }[];
        production_companies?: TMDBProductionCompany[];
      })
    | null
  >(null);
  const [credits, setCredits] = useState<any>(null);
  const [videos, setVideos] = useState<any>(null);
  const [images, setImages] = useState<any>(null);
  const [certification, setCertification] = useState<any>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [visibleEpisodeCount, setVisibleEpisodeCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showPlayerOverlay, setShowPlayerOverlay] = useState(false);
  const [overlayIframeSrc, setOverlayIframeSrc] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | undefined>(undefined);
  const [episodeLocks, setEpisodeLocks] = useState<Record<number, { locked: boolean; reason?: string }>>({});
  const seasonDropdownRef = useRef<HTMLDivElement | null>(null);
  const modalScrollViewportRef = useRef<HTMLDivElement | null>(null);

  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  useEffect(() => {
    if (!open || !mediaId) return;

    const loadMediaDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        if (mediaType === "movie") {
          const [movieDetails, movieCredits, movieVideos, movieImages, movieCert] =
            await Promise.all([
              tmdbApi.getMovieDetails(mediaId),
              tmdbApi.getMovieCredits(mediaId).catch(() => ({ cast: [] })),
              tmdbApi.getMovieVideos(mediaId).catch(() => ({ results: [] })),
              tmdbApi.getMovieImages(mediaId).catch(() => ({ logos: [] })),
              tmdbApi.getMovieCertification(mediaId).catch(() => ({ results: [] })),
            ]);
          setMedia(movieDetails);
          setCredits(movieCredits);
          setVideos(movieVideos);
          setImages(movieImages);
          setCertification(movieCert);
        } else {
          const [tvDetails, tvCredits, tvVideos, tvImages, tvCert] =
            await Promise.all([
              tmdbApi.getTVDetails(mediaId),
              tmdbApi.getTVCredits(mediaId).catch(() => ({ cast: [] })),
              tmdbApi.getTVVideos(mediaId).catch(() => ({ results: [] })),
              tmdbApi.getTVImages(mediaId).catch(() => ({ logos: [] })),
              tmdbApi.getTVContentRatings(mediaId).catch(() => ({ results: [] })),
            ]);
          setMedia(tvDetails as any);
          setCredits(tvCredits);
          setVideos(tvVideos);
          setImages(tvImages);
          setCertification(tvCert);
          setSelectedSeason(1);
        }

        // Trailer
        if (videos?.results) {
          const trailer =
            videos.results.find(
              (v: any) => v.type === "Trailer" && v.site === "YouTube"
            ) ||
            videos.results.find((v: any) => v.site === "YouTube");
          setTrailerKey(trailer ? trailer.key : null);
        } else {
          setTrailerKey(null);
        }

        // Lock status (check whole movie/show)
        const type = mediaType === "movie" ? "movie" : "tv";
        const lockCheck = await checkContentLocked(mediaId, type);
        setIsLocked(lockCheck.locked);
        setLockReason(lockCheck.reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load details");
        console.error("Failed to load media details:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadMediaDetails();
  }, [open, mediaId, mediaType]);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mediaId || mediaType !== "tv") return;

    const loadEpisodes = async () => {
      try {
        setLoadingEpisodes(true);
        setEpisodeLocks({});
        const [seasonData, seasonLocks] = await Promise.all([
          tmdbApi.getTVSeasonEpisodes(mediaId, selectedSeason),
          checkSeasonLocked(mediaId, selectedSeason),
        ]);
        const eps = seasonData.episodes || [];
        setEpisodes(eps);

        // Build episode lock map from single API response
        const locks: Record<number, { locked: boolean; reason?: string }> = {};
        const wholeReason = seasonLocks.wholeShow?.reason ?? seasonLocks.wholeSeason?.reason;
        const isWholeLocked = wholeReason != null;

        for (const ep of eps) {
          const epLock = seasonLocks.episodes[ep.episode_number];
          const locked = isWholeLocked || epLock != null;
          const reason = epLock?.reason ?? wholeReason;
          locks[ep.episode_number] = { locked, reason };
        }
        setEpisodeLocks(locks);
      } catch (err) {
        console.error("Failed to load episodes:", err);
        setEpisodes([]);
      } finally {
        setLoadingEpisodes(false);
      }
    };

    void loadEpisodes();
  }, [open, mediaId, mediaType, selectedSeason]);

  useEffect(() => {
    // Reset visible episodes whenever the season changes or a new list is loaded
    if (episodes.length > 0) {
      setVisibleEpisodeCount(Math.min(6, episodes.length));
    } else {
      setVisibleEpisodeCount(0);
    }
  }, [episodes, selectedSeason]);

  useEffect(() => {
    if (!isSeasonDropdownOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!seasonDropdownRef.current) return;
      if (!seasonDropdownRef.current.contains(event.target as Node)) {
        setIsSeasonDropdownOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSeasonDropdownOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isSeasonDropdownOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setMedia(null);
      setCredits(null);
      setVideos(null);
      setImages(null);
      setCertification(null);
      setEpisodes([]);
      setEpisodeLocks({});
      setComments([]);
      setCommentInput("");
      setCommentError(null);
      setTrailerKey(null);
      setIsMuted(true);
      setShowPlayerOverlay(false);
      setOverlayIframeSrc("");
      setSelectedSeason(1);
      setIsSeasonDropdownOpen(false);
    }, 200);
  };

  const handleWatch = () => {
    if (!mediaId || isLocked) return;
    const type: MediaType = mediaType ?? "movie";

    if (type === "movie") {
      navigate(`/movie/watch/${mediaId}`);
    } else {
      navigate(`/tv/watch/${mediaId}/1/1`);
    }
    // Don't call handleClose() - let the navigation happen naturally
  };

  const handleEpisodeClick = (episodeNumber: number) => {
    if (!mediaId) return;
    const epLock = episodeLocks[episodeNumber];
    if (isLocked || epLock?.locked) return;
    navigate(`/tv/watch/${mediaId}/${selectedSeason}/${episodeNumber}`);
    // Don't call handleClose() - let the navigation happen naturally
  };

  const isEpisodeLocked = (episodeNumber: number) => {
    return isLocked || (episodeLocks[episodeNumber]?.locked ?? false);
  };

  const getEpisodeLockReason = (episodeNumber: number) => {
    return episodeLocks[episodeNumber]?.reason ?? lockReason;
  };

  useEffect(() => {
    if (!open || !mediaId) return;
    const load = async () => {
      const data = await fetchComments(mediaId, mediaType);
      setComments(data);
    };
    void load();
  }, [open, mediaId, mediaType]);

  useEffect(() => {
    if (!open || !mediaId) return;
    setSimilar([]);
    setSimilarLoading(true);
    const load = async () => {
      const data = await fetchSimilar(mediaId, mediaType, getPreferredLanguage());
      setSimilar(Array.isArray(data) ? data : []);
      setSimilarLoading(false);
    };
    void load();
  }, [open, mediaId, mediaType]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaId || !commentInput.trim()) return;
    setCommentSubmitting(true);
    setCommentError(null);
    const { comment, error } = await postComment(mediaId, mediaType, commentInput.trim());
    setCommentSubmitting(false);
    if (comment) {
      setComments((prev) => [comment, ...prev]);
      setCommentInput("");
    } else {
      setCommentError(error || "Failed to post comment.");
    }
  };

  const handleDeleteComment = async (id: number) => {
    const ok = await deleteComment(id);
    if (ok) setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const canDeleteComment = (c: CommentItem) => {
    if (!isAuthenticated) return false;
    const isOwn = String(c.user.id) === String(user?.id ?? "");
    const isAdmin = user?.isAdmin === true;
    return isOwn || isAdmin;
  };

  const getTrailerUrl = (muted: boolean): string => {
    if (!trailerKey) return "";
    return `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${
      muted ? 1 : 0
    }&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}`;
  };

  const openPlayerOverlay = () => {
    if (!trailerKey) return;
    const base = getTrailerUrl(isMuted);
    setOverlayIframeSrc(base.replace("&controls=0", "&controls=1"));
    setShowPlayerOverlay(true);
  };

  const closePlayerOverlay = () => {
    setShowPlayerOverlay(false);
    setOverlayIframeSrc("");
  };

  const toggleOverlayMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!trailerKey) return;
    const base = getTrailerUrl(nextMuted);
    setOverlayIframeSrc(base.replace("&controls=0", "&controls=1"));
  };

  const castList = useMemo(
    () => credits?.cast?.slice(0, 5) || [],
    [credits?.cast]
  );

  const logoPath = useMemo(() => {
    const logos = images?.logos ?? [];
    const enLogo =
      logos.find((logo: any) => logo.iso_639_1 === "en") ?? logos[0] ?? null;
    return enLogo?.file_path ?? null;
  }, [images]);

  const certificationBadge = useMemo(() => {
    if (!certification) return null;

    if (mediaType === "movie") {
      const usRelease = certification.results?.find(
        (r: any) => r.iso_3166_1 === "US"
      );
      if (usRelease?.release_dates) {
        const theatrical =
          usRelease.release_dates.find((rd: any) => rd.type === 3) ??
          usRelease.release_dates[0];
        if (theatrical?.certification) {
          return theatrical.certification;
        }
      }
    } else {
      const usRating = certification.results?.find(
        (r: any) => r.iso_3166_1 === "US"
      );
      if (usRating?.rating) {
        return usRating.rating;
      }
    }
    return null;
  }, [certification, mediaType]);

  const releaseYear = useMemo(() => {
    if (!media) return null;
    if (mediaType === "movie") {
      const movie = media as TMDBMovie;
      if (movie.release_date) {
        return new Date(movie.release_date).getFullYear();
      }
    } else {
      const tv = media as TMDBSeries;
      if (tv.first_air_date) {
        return new Date(tv.first_air_date).getFullYear();
      }
    }
    return null;
  }, [media, mediaType]);

  const formatRuntime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  const availableSeasons = useMemo(() => {
    if (!media || !("seasons" in media) || !media.seasons) return [] as number[];
    return media.seasons
      .map((season: any) => season.season_number)
      .filter((seasonNumber: number) => seasonNumber >= 0);
  }, [media]);

  const getSeasonLabel = (seasonNumber: number) => {
    return seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;
  };

  if (!open) return null;

  const backdropUrl =
    media && "backdrop_path" in media && media.backdrop_path
      ? getBackdropUrl(media.backdrop_path, "large")
      : "";

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] border-0 p-0 cursor-pointer transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClose();
        }}
        aria-label="Close"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-end md:items-center justify-center pt-8 md:pt-4 pb-2 md:pb-4 px-2 md:px-4 pointer-events-none">
        <div
          className={`relative bg-black/95 backdrop-blur-2xl w-full max-w-6xl flex flex-col pointer-events-auto overflow-hidden rounded-t-2xl rounded-b-2xl md:rounded-3xl border border-white/10 shadow-[0_30px_120px_rgba(0,0,0,0.9)] transition-all duration-300 h-[78vh] md:h-auto md:max-h-[98vh] ${
            isClosing ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0"
          }`}
          role="dialog"
          aria-modal="true"
        >
          {/* Blurred background image for modal */}
          {backdropUrl && (
            <div className="absolute inset-0 overflow-hidden rounded-2xl md:rounded-3xl">
              <img
                src={backdropUrl}
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
              <div className="text-white/60 text-sm">Loading details…</div>
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

          {!loading && !error && media && (
            <div className="relative z-10 flex h-full min-h-0 flex-col">
              {/* Top: Backdrop + title & actions */}
              <div className="relative w-full h-[40vh] md:h-[55vh] min-h-[300px] md:min-h-[450px] overflow-hidden rounded-t-2xl md:rounded-t-3xl shrink-0">
                {backdropUrl ? (
                  <>
                    <img
                      src={backdropUrl}
                      alt={
                        "title" in media
                          ? media.title
                          : "name" in media
                          ? media.name
                          : ""
                      }
                      className="w-full h-full object-cover"
                      loading="eager"
                      style={{
                        maskImage: "linear-gradient(to bottom, black 0%, black 55%, rgba(0,0,0,0.6) 80%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, rgba(0,0,0,0.6) 80%, transparent 100%)",
                      }}
                    />
                  </>
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
                  {/* Logo or title */}
                  <div className="mb-4 md:mb-6">
                    {logoPath ? (
                      <div className="max-w-xs md:max-w-md">
                        <img
                          src={`https://image.tmdb.org/t/p/w500${logoPath}`}
                          alt={
                            "title" in media
                              ? media.title
                              : "name" in media
                              ? media.name
                              : ""
                          }
                          className="max-h-20 md:max-h-24 lg:max-h-28 object-contain drop-shadow-2xl"
                          loading="eager"
                        />
                      </div>
                    ) : (
                      <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white drop-shadow-2xl leading-tight">
                        {"title" in media
                          ? media.title
                          : "name" in media
                          ? media.name
                          : ""}
                      </h2>
                    )}
                  </div>

                  {/* Actions + quick meta row (Netflix-style) */}
                  <div className="flex flex-col gap-3 md:gap-4">
                    {/* Primary actions */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={handleWatch}
                        disabled={isLocked}
                        title={isLocked ? (lockReason || "This content is locked") : undefined}
                        className={`inline-flex items-center gap-2 px-6 md:px-7 py-2.5 md:py-3 rounded-full font-semibold text-sm md:text-base shadow-lg transition ${
                          isLocked
                            ? "bg-white/30 text-black/60 cursor-not-allowed"
                            : "bg-white text-black hover:bg-white/90 active:scale-[0.97]"
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="w-4 h-4 md:w-5 md:h-5" />
                        ) : (
                          <Play className="w-4 h-4 md:w-5 md:h-5 fill-black" />
                        )}
                        <span>{isLocked ? "Locked" : "Play Now"}</span>
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full bg-white/15 border-white/30 text-white hover:bg-white/25 active:scale-95 transition"
                        aria-label="Add to list"
                      >
                        <Plus className="w-5 h-5 md:w-6 md:h-6" />
                      </button>

                      {trailerKey && (
                        <button
                          onClick={openPlayerOverlay}
                          className="inline-flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full bg-white/10 border border-white/30 text-white hover:bg-white/20 active:scale-95 transition"
                          aria-label="Play trailer"
                          title="Play trailer"
                        >
                          <Video className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      )}
                    </div>

                    {/* Badges row – MediaCard style */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                      {isLocked && lockReason && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-200 px-3 py-1 backdrop-blur-sm">
                          <Lock className="size-3.5" />
                          <span className="truncate max-w-[140px] sm:max-w-[220px]">
                            {lockReason}
                          </span>
                        </span>
                      )}
                      {media.vote_average && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                          <Star className="size-3.5 fill-[#ffd86b] text-[#ffd86b]" />
                          <span className="text-[#ffd86b]">
                            {media.vote_average.toFixed(1)}
                          </span>
                        </span>
                      )}

                      {releaseYear && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                          <Calendar className="size-3.5 fill-[#dedede] text-[#dedede]" />
                          <span className="text-[#dedede]">{releaseYear}</span>
                        </span>
                      )}

                      {mediaType === "movie" &&
                        "runtime" in media &&
                        media.runtime && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/12 text-white px-3 py-1 backdrop-blur-sm">
                            <Clock className="size-3.5 text-[#dedede]" />
                            <span className="text-[#dedede]">{formatRuntime(media.runtime)}</span>
                          </span>
                        )}

                      {mediaType === "tv" &&
                        "number_of_seasons" in media &&
                        media.number_of_seasons && (
                          <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
                            {media.number_of_seasons} Season
                            {media.number_of_seasons !== 1 ? "s" : ""}
                          </span>
                        )}

                      <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
                        HD
                      </span>

                      {certificationBadge && (
                        <span className="inline-flex items-center rounded-full bg-white/10 text-white px-3 py-1 backdrop-blur-sm">
                          {certificationBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: description + metadata + episodes */}
              <div 
                ref={modalScrollViewportRef}
                className="relative flex-1 min-h-0 overscroll-contain overflow-y-auto overflow-x-hidden pr-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) rgba(255,255,255,0.1)', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                <div className="p-6 md:p-8 space-y-8 md:space-y-10">
                  {/* Description + side metadata (clean, two-column) */}
                  {"overview" in media && media.overview && (
                    <section className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">
                      <div className="md:w-2/3">
                        <h3 className="text-white/60 text-xs md:text-sm font-medium uppercase tracking-wider mb-3">
                          Synopsis
                        </h3>
                        <p className="text-white/85 text-sm md:text-base leading-relaxed">
                          {media.overview}
                        </p>
                      </div>

                      <div className="text-xs md:text-sm text-white/70 space-y-2 md:w-1/3">
                        {"genres" in media &&
                          media.genres &&
                          media.genres.length > 0 && (
                            <p>
                              <span className="text-white/60">Genres: </span>
                              {media.genres.map((g: any) => g.name).join(", ")}
                            </p>
                          )}

                        {castList.length > 0 && (
                          <p>
                            <span className="text-white/60">Cast: </span>
                            {castList
                              .map((actor: any) => actor.name)
                              .slice(0, 4)
                              .join(", ")}
                            {credits?.cast?.length > 4
                              ? `, +${credits.cast.length - 4} more`
                              : ""}
                          </p>
                        )}

                        {"production_companies" in media &&
                          media.production_companies &&
                          media.production_companies.length > 0 &&
                          media.homepage && (
                            <div>
                              <p className="text-white/60 mb-2">Studio:</p>
                              <div className="flex flex-wrap gap-3">
                                {media.production_companies
                                  .filter((company) => company.logo_path)
                                  .slice(0, 3)
                                  .map((company) => (
                                    <a
                                      key={company.id}
                                      href={media.homepage}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block transition-opacity hover:opacity-70"
                                      title={company.name}
                                    >
                                      <img
                                        src={`https://image.tmdb.org/t/p/w154${company.logo_path}`}
                                        alt={company.name}
                                        className="h-8 w-auto object-contain"
                                      />
                                    </a>
                                  ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </section>
                  )}

                  {/* More Like This - same MediaCard carousel as home page */}
                  <section className="border-t border-white/10 pt-6 md:pt-8">
                    {similarLoading ? (
                      <div className="flex items-center gap-2 text-white/50 text-sm py-6">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Loading similar titles…
                      </div>
                    ) : (
                      <MediaCarousel
                        title="More Like This"
                        items={similar
                          .map((item): MediaCarouselItem | null => {
                            const itemType = (item.categories?.includes("Shows") || item.category === "Shows") ? "tv" : "movie";
                            const id = parseInt(item.thirdPartyId, 10);
                            if (Number.isNaN(id)) return null;
                            const extractPath = (url: string | undefined): string | null => {
                              if (!url) return null;
                              const m = url.match(/\/t\/p\/[^/]+\/(.+)$/);
                              return m ? `/${m[1]}` : null;
                            };
                            return {
                              id,
                              title: item.title || "Untitled",
                              poster_path: extractPath(item.image),
                              backdrop_path: extractPath(item.imageBackdrop) ?? extractPath(item.image),
                              release_date: item.releaseDate || item.firstAirDate,
                              rating: item.averageRating != null ? item.averageRating * 2 : 0,
                              media_type: itemType,
                            };
                          })
                          .filter((x): x is MediaCarouselItem => x != null)}
                        onItemClick={(item) =>
                          navigate(`/${item.media_type ?? "movie"}/${item.id}`, {
                            state: { backgroundLocation: (location.state as { backgroundLocation?: Location })?.backgroundLocation ?? location },
                          })
                        }
                      />
                    )}
                  </section>

                  {/* Episodes (TV only) */}
                  {mediaType === "tv" &&
                    "seasons" in media &&
                    media.seasons &&
                    media.seasons.length > 0 && (
                      <section className="border-t border-white/10 pt-6 md:pt-8">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg md:text-xl font-semibold text-white uppercase tracking-wide">
                            Episodes
                          </h3>
                          <div className="flex items-center gap-2">
                            <div className="relative" ref={seasonDropdownRef}>
                              <button
                                type="button"
                                onClick={() =>
                                  setIsSeasonDropdownOpen((open) => !open)
                                }
                                className="min-w-36 inline-flex items-center justify-between gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs md:text-sm text-white hover:bg-white/15 transition-colors"
                                aria-haspopup="listbox"
                                aria-expanded={isSeasonDropdownOpen}
                              >
                                <span>{getSeasonLabel(selectedSeason)}</span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-200 ${
                                    isSeasonDropdownOpen ? "rotate-180" : "rotate-0"
                                  }`}
                                />
                              </button>

                              {isSeasonDropdownOpen && (
                                <div className="absolute right-0 z-20 mt-2 w-full min-w-36 overflow-hidden rounded-xl border border-white/20 bg-black/95 shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                                  <ul
                                    role="listbox"
                                    aria-label="Season selector"
                                    className="max-h-56 overflow-y-auto p-1 hide-native-scrollbar"
                                  >
                                    {availableSeasons.map((seasonNumber) => (
                                      <li key={seasonNumber}>
                                        <button
                                          type="button"
                                          className={`w-full rounded-lg px-3 py-2 text-left text-xs md:text-sm transition-colors ${
                                            selectedSeason === seasonNumber
                                              ? "bg-white/20 text-white"
                                              : "text-white/90 hover:bg-white/12"
                                          }`}
                                          onClick={() => {
                                            setSelectedSeason(seasonNumber);
                                            setIsSeasonDropdownOpen(false);
                                          }}
                                        >
                                          {getSeasonLabel(seasonNumber)}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {loadingEpisodes && (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-white/60 text-xs md:text-sm">
                              Loading episodes…
                            </div>
                          </div>
                        )}

                        {!loadingEpisodes && episodes.length > 0 && (
                          <>
                            <div className="space-y-3">
                              {episodes.slice(0, visibleEpisodeCount).map((episode) => {
                                const epLocked = isEpisodeLocked(episode.episode_number);
                                const epReason = getEpisodeLockReason(episode.episode_number);
                                return (
                              <button
                                key={episode.id}
                                type="button"
                                onClick={() =>
                                  handleEpisodeClick(episode.episode_number)
                                }
                                disabled={epLocked}
                                className={`group relative flex w-full items-start gap-4 md:gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3 md:p-4 text-left transition-all duration-300 ${
                                  epLocked
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer hover:border-white/20 hover:from-white/[0.1] hover:to-white/[0.05] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                                }`}
                              >
                                <div className="relative aspect-video w-48 md:w-60 flex-shrink-0 overflow-hidden rounded-xl shadow-lg transition-all duration-300 ease-out group-hover:shadow-2xl group-hover:scale-[1.02]">
                                  {episode.still_path ? (
                                    <>
                                      <img
                                        src={`https://image.tmdb.org/t/p/w500${episode.still_path}`}
                                        alt={episode.name}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/0 group-hover:bg-white/90 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                                          <Play className="w-5 h-5 md:w-6 md:h-6 text-black fill-black ml-0.5" />
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center rounded-xl">
                                      <Play className="w-12 h-12 md:w-14 md:h-14 text-white/30" />
                                    </div>
                                  )}
                                  <div className="absolute top-2 left-2 flex items-center gap-2">
                                    <div className="flex items-center justify-center min-w-[2.5rem] h-8 px-2.5 rounded-lg bg-gradient-to-br from-black/90 to-black/80 backdrop-blur-md border border-white/20 shadow-lg">
                                      <span className="text-white text-xs md:text-sm font-bold tracking-wide">
                                        E{episode.episode_number}
                                      </span>
                                    </div>
                                    {epLocked && (
                                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-amber-400 text-[10px] md:text-xs font-medium">Locked</span>
                                      </div>
                                    )}
                                  </div>
                                  {episode.runtime && (
                                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/80 backdrop-blur-sm border border-white/10">
                                      <Clock className="size-3.5 text-white/90" />
                                      <span className="text-white/90 text-[10px] md:text-xs font-medium">
                                        {episode.runtime}m
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
                                  <h4 className="text-white text-sm md:text-base font-semibold line-clamp-2 group-hover:text-[#DEDEDE] transition-colors leading-snug">
                                    {episode.name ||
                                      `Episode ${episode.episode_number}`}
                                  </h4>
                                  {epLocked && epReason && (
                                    <p className="text-amber-400/90 text-xs flex items-center gap-1.5">
                                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                                      {epReason}
                                    </p>
                                  )}
                                  {episode.overview && (
                                    <p className="text-white/60 text-xs md:text-sm line-clamp-3 leading-relaxed group-hover:text-white/80 transition-colors">
                                      {episode.overview}
                                    </p>
                                  )}
                                  {episode.air_date && (
                                    <p className="text-white/40 text-[10px] md:text-xs mt-auto">
                                      {new Date(episode.air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                            })}
                            </div>

                            {episodes.length > 6 && (
                              <div className="mt-4 flex justify-center gap-2">
                                {visibleEpisodeCount > 6 && (
                                  <button
                                    type="button"
                                    onClick={() => setVisibleEpisodeCount(6)}
                                    className="px-4 py-2 rounded-full border border-white/20 bg-white/5 text-xs md:text-sm text-white/80 hover:bg-white/10 transition-colors"
                                  >
                                    Show less
                                  </button>
                                )}
                                {visibleEpisodeCount < episodes.length && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleEpisodeCount((prev) =>
                                        Math.min(prev + 6, episodes.length)
                                      )
                                    }
                                    className="px-4 py-2 rounded-full border border-white/20 bg-white/5 text-xs md:text-sm text-white/80 hover:bg-white/10 transition-colors"
                                  >
                                    Show more
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {!loadingEpisodes && episodes.length === 0 && (
                          <div className="text-white/60 text-xs md:text-sm text-center py-8">
                            No episodes available for this season.
                          </div>
                        )}
                      </section>
                    )}

                  {/* Comments */}
                  <section className="border-t border-white/10 pt-6 md:pt-8">
                    <h3 className="text-lg md:text-xl font-semibold text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                      <MessageCircle className="w-5 h-5" />
                      Comments
                    </h3>

                    {isAuthenticated && (
                      <form onSubmit={handlePostComment} className="mb-6">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            placeholder="Add a comment…"
                            maxLength={2000}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                          />
                          <button
                            type="submit"
                            disabled={commentSubmitting || !commentInput.trim()}
                            className="px-4 py-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            Post
                          </button>
                        </div>
                        {commentError && <p className="text-red-400/90 text-sm mt-2">{commentError}</p>}
                      </form>
                    )}

                    {!isAuthenticated && (
                      <p className="text-white/50 text-sm mb-4">Sign in to comment.</p>
                    )}

                    <div className="space-y-4">
                      {comments.length === 0 ? (
                        <p className="text-white/50 text-sm py-4">No comments yet.</p>
                      ) : (
                        comments.map((c) => (
                          <div
                            key={c.id}
                            className="flex gap-3 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5"
                          >
                            <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              {c.user.avatar ? (
                                <img src={c.user.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="text-white/60 text-sm font-medium">
                                  {c.user.displayName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-white text-sm">{c.user.displayName}</p>
                                  {c.user.isOwner && (
                                    <span className="inline-flex items-center p-1 rounded bg-violet-500/25 border border-violet-500/40" title="Owner">
                                      <Crown className="w-3 h-3 text-violet-400" />
                                    </span>
                                  )}
                                  {c.user.isAdmin && !c.user.isOwner && (
                                    <span className="inline-flex items-center p-1 rounded bg-amber-500/25 border border-amber-500/40" title="Admin">
                                      <Shield className="w-3 h-3 text-amber-400" />
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white/40 text-xs">
                                    {new Date(c.createdAt).toLocaleDateString()}
                                  </span>
                                  {canDeleteComment(c) && (
                                    <button
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="p-1.5 rounded text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition"
                                      title="Delete comment"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-white/85 text-sm mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trailer overlay */}
      {showPlayerOverlay && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closePlayerOverlay}
            aria-label="Close trailer overlay"
          />
          <div className="relative w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <button
              type="button"
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/80 hover:bg-black/95 text-white border border-white/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={closePlayerOverlay}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {overlayIframeSrc && (
              <iframe
                src={overlayIframeSrc}
                className="w-full h-full"
                frameBorder="0"
                allow="autoplay"
                allowFullScreen
                title="Trailer player"
              />
            )}

            {trailerKey && (
              <div className="absolute top-3 left-3 z-10">
                <button
                  type="button"
                  onClick={toggleOverlayMute}
                  className="w-10 h-10 rounded-full bg-black/75 hover:bg-black/90 border border-white/30 text-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                  aria-label={isMuted ? "Unmute trailer" : "Mute trailer"}
                  title={isMuted ? "Unmute trailer" : "Mute trailer"}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Tailwind helpers for scrollbars (kept close to component for portability)
// These rely on global styles / utilities in your Tailwind setup.


