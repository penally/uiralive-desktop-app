import React, { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, Play, X, Bookmark, Eye } from "lucide-react";
import { tmdbApi } from "../../../lib/tmdb";

interface TVShowWithSeasons {
  id: number;
  name: string;
  seasons?: Array<{
    season_number: number;
    name: string;
    episode_count: number;
  }>;
  number_of_seasons?: number;
}

export interface EpisodesMenuProps {
  isOpen: boolean;
  tmdbId: number;
  currentSeason?: number;
  currentEpisode?: number;
  settingsButtonRef: HTMLElement | null;
  controlsBarRef: HTMLElement | null;
  onClose: () => void;
  onSelectEpisode: (season: number, episode: number) => void;
}

const MENU_HEIGHT = 420;
const MENU_WIDTH = 1480;

export const EpisodesMenu: React.FC<EpisodesMenuProps> = ({
  isOpen,
  tmdbId,
  currentSeason,
  currentEpisode,
  settingsButtonRef,
  controlsBarRef,
  onClose,
  onSelectEpisode,
}) => {
  const [tvShow, setTvShow] = useState<TVShowWithSeasons | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [indicatorLine, setIndicatorLine] = useState({
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    visible: false,
  });

  const menuElementRef = useRef<HTMLDivElement | null>(null);
  const episodesScrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && tmdbId && !tvShow) {
      loadTVShow();
    }
  }, [isOpen, tmdbId, tvShow]);

  const loadTVShow = async () => {
    try {
      setLoading(true);
      const data = (await tmdbApi.getTVDetails(tmdbId)) as TVShowWithSeasons;
      setTvShow(data);
      if (data?.seasons && data.seasons.length > 0) {
        if (currentSeason !== undefined) {
          setSelectedSeason(currentSeason);
          await loadEpisodes(currentSeason);
        } else {
          const firstSeason = data.seasons[0].season_number || 1;
          setSelectedSeason(firstSeason);
          await loadEpisodes(firstSeason);
        }
      }
    } catch (error) {
      console.error("Error loading TV show:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (seasonNumber: number) => {
    if (seasonNumber === null) return;
    try {
      setLoadingEpisodes(true);
      setEpisodesError(null);
      const seasonData = await tmdbApi.getTVSeasonEpisodes(tmdbId, seasonNumber);
      setEpisodes(seasonData.episodes || []);
    } catch (error) {
      console.error("Error loading episodes:", error);
      setEpisodes([]);
      setEpisodesError(
        "Failed to fetch episodes. Try a different season or come back later."
      );
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const scrollEpisodes = (direction: "left" | "right") => {
    if (episodesScrollContainerRef.current) {
      const scrollAmount = 400;
      const scrollLeft = episodesScrollContainerRef.current.scrollLeft;
      const newScrollLeft =
        direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      episodesScrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  const handleSeasonSelect = (seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    loadEpisodes(seasonNumber);
  };

  const handleEpisodeSelect = (seasonNumber: number, episodeNumber: number) => {
    onSelectEpisode(seasonNumber, episodeNumber);
    onClose();
  };

  useEffect(() => {
    if (isOpen && menuElementRef.current) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const sidePadding = 24;
      const width = Math.min(MENU_WIDTH, vw - sidePadding);

      const ref = controlsBarRef || settingsButtonRef;
      let top: number;

      if (ref) {
        const refRect = ref.getBoundingClientRect();
        if (controlsBarRef) {
          const progressBarTop = refRect.top - 60;
          top = progressBarTop - MENU_HEIGHT - 8;
        } else {
          top = refRect.top - MENU_HEIGHT - 8;
        }
      } else {
        top = vh - MENU_HEIGHT - 100;
      }

      top = Math.max(8, Math.min(top, vh - MENU_HEIGHT - 16));
      const left = (vw - width) / 2;
      setMenuPosition({ top, left, width });

      const settingsBtnRect = settingsButtonRef?.getBoundingClientRect();
      if (settingsBtnRect) {
        setIndicatorLine({
          x1: settingsBtnRect.left + settingsBtnRect.width / 2,
          y1: settingsBtnRect.top + settingsBtnRect.height / 2,
          x2: left + width / 2,
          y2: top,
          visible: true,
        });
      } else {
        setIndicatorLine((prev) => ({ ...prev, visible: false }));
      }
    }
  }, [isOpen, controlsBarRef, settingsButtonRef]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
      />

      {indicatorLine.visible && (
        <svg
          className="fixed inset-0 pointer-events-none"
          style={{ width: "100vw", height: "100vh", zIndex: 45 }}
        >
          <line
            x1={indicatorLine.x1}
            y1={indicatorLine.y1}
            x2={indicatorLine.x2}
            y2={indicatorLine.y2}
            stroke="rgba(96, 165, 250, 0.5)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="transition-opacity duration-200"
          />
        </svg>
      )}

      <div
        ref={menuElementRef}
        className={`fixed z-50 pointer-events-auto transition-all duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          width: `${menuPosition.width}px`,
          height: `${MENU_HEIGHT}px`,
          maxWidth: "calc(100vw - 32px)",
          transform: `translateY(1px) ${isOpen ? "scale(1)" : "scale(0.95)"}`,
        }}
        role="dialog"
        tabIndex={0}
        aria-modal="true"
      >
        <div className="h-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-black flex flex-col">
          {loading && !tvShow ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/60 text-sm">Loading...</div>
            </div>
          ) : tvShow ? (
            <>
              <div className="px-6 pt-4 pb-3 border-b border-white/10 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold tracking-[0.25em] text-white/40 uppercase">
                    Episodes
                  </span>
                  <h2 className="text-white text-lg md:text-xl font-semibold truncate">
                    {tvShow.name}
                  </h2>
                </div>
                <button
                  type="button"
                  className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/40 transition-colors"
                  onClick={onClose}
                  aria-label="Close episodes"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-black/95 via-black/95 to-black">
                <div className="px-6 pt-3 pb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pr-2">
                    <span className="text-white/70 text-sm font-medium whitespace-nowrap">
                      Season {selectedSeason ?? tvShow.seasons?.[0]?.season_number ?? 1}
                    </span>
                    <div className="h-4 w-px bg-white/15 hidden sm:block" />
                    <div className="flex items-center gap-2">
                      {(tvShow.seasons || []).map(
                        (seasonItem) =>
                          seasonItem.season_number >= 1 && (
                            <button
                              key={seasonItem.season_number}
                              type="button"
                              className={`px-3 py-1.5 rounded-full text-[11px] md:text-xs font-medium whitespace-nowrap border transition-colors ${
                                selectedSeason === seasonItem.season_number
                                  ? "bg-white text-black border-white"
                                  : "bg-white/5 text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
                              }`}
                              onClick={() =>
                                handleSeasonSelect(seasonItem.season_number || 0)
                              }
                            >
                              Season {seasonItem.season_number}
                            </button>
                          )
                      )}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => scrollEpisodes("left")}
                      className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/20 text-white transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollEpisodes("right")}
                      className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/20 text-white transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 px-6 pb-5 overflow-hidden">
                  {loadingEpisodes && episodes.length === 0 ? (
                    <div className="flex gap-4 overflow-hidden">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 w-64 md:w-72 lg:w-80 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden animate-pulse"
                        >
                          <div className="aspect-video bg-white/[0.06]" />
                          <div className="p-3 space-y-2">
                            <div className="h-4 bg-white/15 rounded w-3/4" />
                            <div className="h-3 bg-white/10 rounded w-full" />
                            <div className="h-3 bg-white/5 rounded w-2/3" />
                            <div className="mt-2 h-0.5 bg-white/10 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : episodesError ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="max-w-sm text-center space-y-3">
                        <div className="mx-auto w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <X className="w-5 h-5 text-white/70" />
                        </div>
                        <h3 className="text-white text-base font-semibold">
                          Couldn't load episodes
                        </h3>
                        <p className="text-white/60 text-sm">{episodesError}</p>
                      </div>
                    </div>
                  ) : episodes.length > 0 ? (
                    <div
                      ref={episodesScrollContainerRef}
                      className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 scrollbar-hide"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      {episodes.map((episode) => {
                        const airDate = episode.air_date
                          ? new Date(episode.air_date)
                          : null;
                        const isUnreleased = airDate
                          ? airDate.getTime() > Date.now()
                          : false;

                        return (
                          <button
                            key={episode.episode_number}
                            type="button"
                            disabled={isUnreleased}
                            onClick={() => {
                              if (!isUnreleased) {
                                handleEpisodeSelect(
                                  selectedSeason!,
                                  episode.episode_number
                                );
                              }
                            }}
                            className={`group relative flex-shrink-0 w-64 md:w-72 lg:w-80 text-left rounded-xl bg-white/[0.03] border border-white/10 transition-all duration-300 overflow-hidden ${
                              currentSeason === selectedSeason &&
                              currentEpisode === episode.episode_number
                                ? "ring-2 ring-[var(--player-accent)]"
                                : ""
                            } ${
                              isUnreleased
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:border-white/25 hover:bg-white/[0.06] cursor-pointer"
                            }`}
                          >
                            <div className="relative aspect-video overflow-hidden">
                              {episode.still_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w500${episode.still_path}`}
                                  alt={episode.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-white/10 via-white/[0.03] to-white/[0.02] flex items-center justify-center">
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 border border-white/20 backdrop-blur-sm">
                                    <Play className="w-4 h-4 text-white/80" />
                                    <span className="text-[11px] text-white/70 font-medium">
                                      Preview unavailable
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="absolute top-2 left-2 bg-black/75 border border-white/20 rounded px-2 py-0.5 shadow-sm">
                                <span className="text-white text-xs font-semibold">
                                  E{episode.episode_number}
                                </span>
                              </div>

                              <div className="absolute top-2 right-2 flex items-center gap-1">
                                <div className="w-7 h-7 rounded-full bg-black/75 border border-white/20 flex items-center justify-center">
                                  <Bookmark className="w-3.5 h-3.5 text-white/80" />
                                </div>
                                <div className="w-7 h-7 rounded-full bg-black/75 border border-white/20 flex items-center justify-center">
                                  <Eye className="w-3.5 h-3.5 text-white/80" />
                                </div>
                              </div>

                              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
                            </div>

                            <div className="p-3 pb-3 flex flex-col gap-1.5">
                              <h4 className="text-white text-sm md:text-base font-semibold line-clamp-2 group-hover:text-[var(--player-accent)] transition-colors">
                                {episode.episode_number}.{" "}
                                {episode.name || `Episode ${episode.episode_number}`}
                              </h4>
                              {episode.overview && (
                                <p className="text-white/70 text-xs md:text-sm line-clamp-2 leading-relaxed">
                                  {episode.overview}
                                </p>
                              )}
                              {isUnreleased && airDate ? (
                                <div className="mt-1 text-[11px] text-white/60">
                                  Airs on{" "}
                                  {airDate.toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                              ) : (
                                episode.air_date && (
                                  <div className="mt-1 text-[11px] text-white/40">
                                    Aired on{" "}
                                    {new Date(episode.air_date).toLocaleDateString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      }
                                    )}
                                  </div>
                                )
                              )}
                              <div className="mt-2 h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full w-full bg-[var(--player-accent)]" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="max-w-sm text-center space-y-2">
                        <h3 className="text-white text-base font-semibold">
                          No episodes available
                        </h3>
                        <p className="text-white/60 text-sm">
                          We couldn't find any episodes for this season.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default EpisodesMenu;
