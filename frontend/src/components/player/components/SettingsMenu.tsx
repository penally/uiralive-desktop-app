import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Users,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";
import QualitySelection from "./QualitySelection";
import SubtitleSelection from "./SubtitleSelection";
import type {
  MediaSource,
  SubtitleTrack,
  PlayerSettings,
  PlayerState,
} from "../lib/types";
import type { ServerConfig, SubServer } from "../servers/index";
import { Icon } from "@iconify/react";
import { WYZIE_API_BASE } from "../lib/api";

export interface HlsAudioTrack {
  id: number;
  name: string;
  lang: string;
  default: boolean;
}

function JoinWatchPartyForm({
  onJoin,
  onCancel,
  isLoggedIn,
  savedDisplayName,
}: {
  onJoin: (code: string, displayName?: string | null) => void;
  onCancel: () => void;
  isLoggedIn: boolean;
  savedDisplayName: string | null;
}) {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState(savedDisplayName || "");
  const isValid = code.length === 4;
  return (
    <div className="flex flex-col gap-2">
      {!isLoggedIn && (
        <input
          type="text"
          maxLength={32}
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full p-2.5 rounded-lg border bg-white/5 border-white/10 text-white text-sm placeholder:text-white/40"
        />
      )}
      <input
        type="text"
        maxLength={4}
        placeholder="XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        className="w-full p-3 rounded-lg border bg-white/5 border-white/10 text-white text-center font-mono text-lg tracking-widest placeholder:text-white/30"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => isValid && onJoin(code, displayName.trim() || null)}
          disabled={!isValid}
          className="flex-1 p-2.5 rounded-lg border bg-[var(--player-accent)]/30 border-[var(--player-accent)]/50 hover:bg-[var(--player-accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
        >
          Join
        </button>
      </div>
    </div>
  );
}

export interface SettingsMenuProps {
  isOpen: boolean;
  sources: MediaSource[];
  currentQuality: string;
  currentSource: MediaSource | null;
  subtitleTracks: SubtitleTrack[];
  settings: PlayerSettings;
  playerState: PlayerState;
  settingsButtonRef: HTMLElement | null;
  controlsBarRef: HTMLElement | null;
  watchPartyRoomId?: string | null;
  serverConfigs: ServerConfig[];
  selectedServerId: string | null;
  tmdbId?: number;
  season?: number;
  episode?: number;
  hlsAudioTracks?: HlsAudioTrack[];
  currentHlsAudioTrack?: number;
  onSelectServer: (
    serverId: string,
    subServerName?: string
  ) => Promise<boolean> | boolean;
  onClose: () => void;
  onSubtitleChange: (track: SubtitleTrack | null) => void;
  onSubtitleToggle: (enabled: boolean) => void;
  onSubtitleSettingsChange?: (
    key: keyof PlayerSettings,
    value: unknown
  ) => void;
  onDownload: () => void;
  watchPartyParticipants?: Array<{ userId: string; displayName: string; avatar: string | null; isHost: boolean; canSkip: boolean }>;
  watchPartyHostId?: string | null;
  watchPartyUserId?: string | null;
  watchPartyOverlayVisible?: boolean;
  onWatchPartyCreate: (displayName?: string | null, allowOffensiveWords?: boolean) => void;
  onWatchPartyJoin: (code: string, displayName?: string | null) => void;
  isLoggedIn?: boolean;
  savedGuestDisplayName?: string | null;
  onWatchPartyLeave: () => void;
  onRemoveParticipant?: (targetUserId: string) => void;
  onGrantSkip?: (targetUserId: string, canSkip: boolean) => void;
  onWatchPartyOverlayToggle: (visible: boolean) => void;
  onOpenChat?: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onQualityChange: (quality: string) => void;
  onAutoQualityToggle: (enabled: boolean) => void;
  onAutoNextToggle: (enabled: boolean) => void;
  onAudioTrackChange?: (trackId: number) => void;
}

type ViewType =
  | "main"
  | "quality"
  | "subtitles"
  | "audio"
  | "playback"
  | "debug"
  | "servers"
  | "servers-sub"
  | "server-loading"
  | "watch-party";

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  sources,
  currentQuality,
  currentSource,
  subtitleTracks,
  settings,
  playerState,
  settingsButtonRef,
  controlsBarRef,
  watchPartyRoomId: _watchPartyRoomId = null,
  serverConfigs,
  selectedServerId,
  tmdbId,
  season,
  episode,
  hlsAudioTracks = [],
  currentHlsAudioTrack = 0,
  onSelectServer,
  onClose,
  onSubtitleChange,
  onSubtitleToggle,
  onSubtitleSettingsChange,
  onDownload,
  watchPartyParticipants = [],
  watchPartyHostId = null,
  watchPartyUserId = null,
  watchPartyOverlayVisible = false,
  onWatchPartyCreate,
  onWatchPartyJoin,
  onWatchPartyLeave,
  onRemoveParticipant,
  onGrantSkip,
  onWatchPartyOverlayToggle,
  onOpenChat,
  isLoggedIn = false,
  savedGuestDisplayName = null,
  onPlaybackRateChange,
  onQualityChange,
  onAutoQualityToggle,
  onAutoNextToggle,
  onAudioTrackChange,
}) => {
  const [subServersCache, setSubServersCache] = useState<
    Map<string, SubServer[]>
  >(new Map());
  const [subServerErrors, setSubServerErrors] = useState<Map<string, string>>(
    new Map()
  );
  const [currentSubServerView, setCurrentSubServerView] = useState<
    string | null
  >(null);
  const [failedServers, setFailedServers] = useState<Set<string>>(new Set());
  const [selectingServerId, setSelectingServerId] = useState<string | null>(
    null
  );
  const [, setServerSelectionError] = useState<string | null>(null);
  const [menuHeight, setMenuHeight] = useState(460);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [view, setView] = useState<ViewType>("main");
  const [currentLoadingServer, setCurrentLoadingServer] = useState<{
    id: string;
    name: string;
    subServerName?: string;
  } | null>(null);

  const menuElementRef = useRef<HTMLDivElement | null>(null);

  const parseSelectedServer = useMemo(() => {
    if (!selectedServerId)
      return { serverId: null, subServerName: null };
    const parts = selectedServerId.split(":");
    if (parts.length === 2) {
      return { serverId: parts[0], subServerName: parts[1] };
    }
    return { serverId: selectedServerId, subServerName: null };
  }, [selectedServerId]);

  const navigateToSubServers = async (serverId: string) => {
    setCurrentSubServerView(serverId);
    setView("servers-sub");

    if (
      !subServersCache.has(serverId) &&
      !subServerErrors.has(serverId)
    ) {
      const server = serverConfigs.find((s) => s.id === serverId);
      if (server?.getSubServers && tmdbId) {
        try {
          const subServers = await server.getSubServers(
            tmdbId,
            season,
            episode
          );
          if (subServers.length === 0) {
            setSubServerErrors(
              new Map(subServerErrors.set(serverId, "No sub-servers available"))
            );
          } else {
            setSubServersCache(new Map(subServersCache.set(serverId, subServers)));
          }
        } catch (error) {
          console.error("Error loading sub-servers:", error);
          setSubServerErrors(
            new Map(
              subServerErrors.set(
                serverId,
                error instanceof Error ? error.message : "Failed to scrape"
              )
            )
          );
        }
      } else {
        setSubServerErrors(
          new Map(subServerErrors.set(serverId, "Failed to scrape"))
        );
      }
    }
  };

  const getQualityDisplay = (quality: string): string => {
    if (!quality) return "Auto";
    const q = quality.toUpperCase();
    if (q === "ORG") return "4K";
    return q.replace("P", "p");
  };

  const getSourceDisplay = (): {
    serverName: string;
    subServerName: string | null;
  } => {
    if (selectedServerId) {
      const parsed = parseSelectedServer;
      const selectedServer = parsed.serverId
        ? serverConfigs.find((server) => server.id === parsed.serverId)
        : null;
      if (selectedServer) {
        return {
          serverName: selectedServer.name,
          subServerName: parsed.subServerName || null,
        };
      }
    }
    if (currentSource?.name) {
      return { serverName: currentSource.name, subServerName: null };
    }
    return { serverName: "—", subServerName: null };
  };

  const getSubtitleDisplay = (): string => {
    if (!settings.subtitle) return "Off";
    return settings.subtitle.display || settings.subtitle.label || "On";
  };

  const getAudioDisplay = (): string => {
    if (hlsAudioTracks.length === 0) return "Default";
    const currentTrack = hlsAudioTracks.find(t => t.id === currentHlsAudioTrack);
    if (!currentTrack) return "Default";
    return currentTrack.name || currentTrack.lang.toUpperCase() || "Default";
  };

  const handleServerSelect = async (
    serverId: string,
    subServerName?: string
  ) => {
    setServerSelectionError(null);
    const server = serverConfigs.find((s) => s.id === serverId);
    if (!server) return;

    const fullId = subServerName ? `${serverId}:${subServerName}` : serverId;
    setSelectingServerId(fullId);

    setCurrentLoadingServer({
      id: serverId,
      name: server.name,
      subServerName,
    });
    setView("server-loading");

    try {
      const result = await onSelectServer(serverId, subServerName);
      setSelectingServerId(null);

      if (result === false) {
        setFailedServers(new Set(failedServers.add(fullId)));
        setView(subServerName ? "servers-sub" : "servers");
        setCurrentLoadingServer(null);
        return;
      }

      setFailedServers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fullId);
        return newSet;
      });
      setView("main");
      setCurrentLoadingServer(null);
      onClose();
    } catch (error) {
      setSelectingServerId(null);
      setFailedServers(new Set(failedServers.add(fullId)));
      setView(subServerName ? "servers-sub" : "servers");
      setCurrentLoadingServer(null);
    }
  };

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight;
      const isLandscape = window.innerWidth > window.innerHeight;
      const maxH = vh - 24;
      if (isLandscape) {
        setMenuHeight(Math.min(520, maxH));
      } else {
        setMenuHeight(Math.min(460, maxH));
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      const timeoutId = window.setTimeout(() => {
        setView("main");
        setCurrentSubServerView(null);
        setCurrentLoadingServer(null);
        setServerSelectionError(null);
        setFailedServers(new Set());
        setMenuPosition(null);
      }, 200);
      return () => window.clearTimeout(timeoutId);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && menuElementRef.current) {
      const ref = settingsButtonRef || controlsBarRef;
      if (ref) {
        const refRect = ref.getBoundingClientRect();
        const controlsRect = controlsBarRef?.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isLandscape = vw > vh;

        let top: number;
        let right: number;

        if (settingsButtonRef) {
          top = refRect.top - menuHeight - 8;
          right = controlsRect ? vw - controlsRect.right : vw - refRect.right;
        } else if (controlsBarRef) {
          const progressBarTop = refRect.top - 60;
          top = progressBarTop - menuHeight - 8;
          right = vw - refRect.right;
        } else {
          top = vh - menuHeight - 100;
          right = 4;
        }

        if (isLandscape) {
          if (top < 4) {
            top = 4;
          }
          if (top + menuHeight > vh - 4) {
            top = vh - menuHeight - 4;
          }
        } else {
          if (top < 4) {
            top = 4;
          }
        }

        const menuWidth = 320;
        if (right + menuWidth > vw - 4) {
          right = vw - menuWidth - 4;
        }
        if (right < 4) {
          right = 4;
        }

        const rafId = window.requestAnimationFrame(() => {
          setMenuPosition({ top, right });
        });
        return () => window.cancelAnimationFrame(rafId);
      } else {
        const vh = window.innerHeight;
        const rafId = window.requestAnimationFrame(() => {
          setMenuPosition({ top: vh - menuHeight - 100, right: 4 });
        });
        return () => window.cancelAnimationFrame(rafId);
      }
    }
  }, [isOpen, menuHeight, controlsBarRef, settingsButtonRef]);

  const isSubtitlesEnabled = settings.subtitle !== null;
  const autoQuality = (settings as any).autoQuality || false;
  const currentSubtitle = settings.subtitle;
  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const isTVShow = season !== undefined && episode !== undefined;
  const autoNextEnabled = ((settings as any).autoNext ?? true) as boolean;
  const sourceDisplay = getSourceDisplay();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        role="button"
        tabIndex={0}
        onClick={() => {
          setView("main");
          onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setView("main");
            onClose();
          }
        }}
      />

      <div
        ref={menuElementRef}
        className="fixed z-50 w-80 sm:w-80 pointer-events-auto will-change-transform"
        style={{
          top: menuPosition ? `${menuPosition.top}px` : "-9999px",
          right: menuPosition ? `${menuPosition.right}px` : "4px",
          height: `${menuHeight}px`,
          maxWidth: "calc(100vw - 16px)",
          opacity: menuPosition ? 1 : 0,
          transform: menuPosition ? "translateY(0) scale(1)" : "translateY(6px) scale(0.97)",
          transition: menuPosition ? "opacity 0.18s ease-out, transform 0.18s cubic-bezier(0.16,1,0.3,1)" : "none",
        }}
        role="dialog"
        tabIndex={0}
        aria-modal="true"
      >
        <div className="h-full rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden bg-black/40 backdrop-blur-2xl flex flex-col">
          <div className="relative flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
                view === "main"
                  ? "translate-x-0"
                  : "-translate-x-full opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                  <Icon
                    icon="solar:settings-bold"
                    className="w-4 h-4 text-white"
                  />
                  <h2 className="text-white text-base font-semibold">
                    Settings
                  </h2>
                </div>
                <div className="flex-1 p-4 overflow-y-auto scrollbar-thin min-h-0">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => setView("quality")}
                      className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all text-left relative"
                    >
                      <div className="text-white/60 text-xs mb-1">Quality</div>
                      <div className="text-white text-base font-semibold truncate">
                        {getQualityDisplay(currentQuality)}
                      </div>
                      <div className="absolute top-2 right-2">
                        <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                      </div>
                    </button>

                    <button
                      onClick={() => setView("servers")}
                      className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all text-left relative"
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          icon="solar:server-square-cloud-bold"
                          className="w-4 h-4 text-white/70"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-white/60 text-xs mb-0.5">
                            Server
                          </div>
                          <div className="text-white text-base font-semibold truncate">
                            {sourceDisplay.serverName}
                          </div>
                          {sourceDisplay.subServerName && (
                            <div className="text-white/60 text-xs truncate">
                              {sourceDisplay.subServerName}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedServerId && (
                        <div className="absolute top-2 right-2">
                          <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setView("subtitles")}
                      className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all text-left relative"
                    >
                      <div className="text-white/60 text-xs mb-1">
                        Subtitles
                      </div>
                      <div className="text-white text-base font-semibold truncate">
                        {getSubtitleDisplay()}
                      </div>
                      <div className="absolute top-2 right-2">
                        <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                      </div>
                    </button>

                    <button
                      onClick={() => hlsAudioTracks.length > 0 && setView("audio")}
                      disabled={hlsAudioTracks.length === 0}
                      className={`bg-white/5 rounded-lg p-3 border border-white/10 text-left relative ${
                        hlsAudioTracks.length > 0 ? "hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer" : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="text-white/60 text-xs mb-1">Audio</div>
                      <div className="text-white text-base font-semibold truncate">
                        {getAudioDisplay()}
                      </div>
                      {hlsAudioTracks.length > 0 && (
                        <div className="absolute top-2 right-2">
                          <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1 mb-3">
                    <button
                      onClick={() => setView("watch-party")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">
                          Watch Party
                        </span>
                        {_watchPartyRoomId && (
                          <span className="text-white/60 text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">
                            {_watchPartyRoomId}
                          </span>
                        )}
                      </div>
                      <Users className="w-4 h-4 text-white/60" />
                    </button>

                    <button
                      onClick={() => setView("debug")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                    >
                      <span className="text-white text-sm font-medium">
                        Debug
                      </span>
                      <Icon
                        icon="solar:bug-bold"
                        className="w-4 h-4 text-white/60"
                      />
                    </button>
                  </div>

                  <div className="h-px bg-white/10 mb-3" />

                  <div className="space-y-1">
                    <button
                      onClick={() => onSubtitleToggle(!isSubtitlesEnabled)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                    >
                      <span className="text-white text-sm font-medium">
                        Enable Subtitles
                      </span>
                      {isSubtitlesEnabled ? (
                        <ToggleRight className="w-5 h-5 text-[var(--player-accent)]" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-white/40" />
                      )}
                    </button>

                    <button
                      onClick={() => setView("playback")}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                    >
                      <span className="text-white text-sm font-medium">
                        Playback settings
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/60" />
                    </button>

                    <div className="relative mt-4">
                      <div className="absolute -top-3 left-0 right-0 text-center z-10">
                        <span className="inline-block bg-yellow-500/90 text-black text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          Coming Soon
                        </span>
                      </div>
                      <div className="w-full flex items-center justify-between p-2.5 rounded-lg border bg-white/5 border-white/10 opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">
                            Skip Segments
                          </span>
                        </div>
                        <Icon
                          icon="solar:skip-next-bold"
                          className="w-4 h-4 text-white/60"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {view === "quality" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "quality"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <QualitySelection
                  isOpen={true}
                  sources={sources}
                  currentQuality={currentQuality}
                  currentSource={currentSource}
                  autoQuality={autoQuality}
                  playerState={playerState}
                  inline={true}
                  onClose={() => setView("main")}
                  onQualityChange={(quality: string) => {
                    onQualityChange(quality);
                    setView("main");
                  }}
                  onAutoQualityToggle={onAutoQualityToggle}
                  onSwitchSource={() => setView("servers")}
                />
              </div>
            )}

            {view === "subtitles" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "subtitles"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <SubtitleSelection
                  isOpen={true}
                  subtitleTracks={subtitleTracks}
                  currentSubtitle={currentSubtitle}
                  inline={true}
                  settings={settings}
                  onClose={() => setView("main")}
                  onSubtitleChange={(track: SubtitleTrack | null) => {
                    onSubtitleChange(track);
                    setView("main");
                  }}
                  onSettingsChange={onSubtitleSettingsChange}
                />
              </div>
            )}

            {view === "audio" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "audio"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                    <button
                      onClick={() => setView("main")}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <h2 className="text-white text-base font-semibold">Audio Track</h2>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4 flex flex-col min-h-0">
                    <div className="flex flex-col gap-2">
                      {hlsAudioTracks.map((track) => {
                        const selected = track.id === currentHlsAudioTrack;

                        return (
                          <button
                            key={track.id}
                            onClick={() => {
                              if (onAudioTrackChange) {
                                onAudioTrackChange(track.id);
                                setView("main");
                              }
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                              selected
                                ? "bg-[var(--player-accent)]/20 border-[var(--player-accent)]"
                                : "bg-black/50 border-white/10 hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded-full border-2 ${
                                  selected ? "border-[var(--player-accent)] bg-[var(--player-accent)]" : "border-white/30"
                                }`}
                              >
                                {selected && (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                  </div>
                                )}
                              </div>
                              <div className="text-left">
                                <span className="text-white font-medium block">{track.name}</span>
                                <span className="text-white/60 text-xs">{track.lang.toUpperCase()}</span>
                              </div>
                            </div>
                            {track.default && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--player-accent)]/30 text-white/80">
                                Default
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "watch-party" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "watch-party"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                    <button
                      onClick={() => setView("main")}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <h2 className="text-white text-base font-semibold">Watch Party</h2>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4 flex flex-col gap-4">
                    {!_watchPartyRoomId ? (
                      <>
                        {!isLoggedIn && (
                          <div>
                            <label className="text-white/60 text-xs block mb-1">Display name (optional)</label>
                            <input
                              type="text"
                              maxLength={32}
                              placeholder="How others see you"
                              defaultValue={savedGuestDisplayName || ""}
                              id="watch-party-create-display-name"
                              className="w-full p-2.5 rounded-lg border bg-white/5 border-white/10 text-white text-sm placeholder:text-white/40"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-white/5 border-white/10">
                          <label htmlFor="watch-party-allow-offensive" className="text-white/70 text-sm cursor-pointer flex-1">
                            Allow offensive words in chat
                          </label>
                          <input
                            type="checkbox"
                            id="watch-party-allow-offensive"
                            className="rounded border-white/20 bg-white/5 text-[var(--player-accent)] focus:ring-[var(--player-accent)] w-4 h-4 cursor-pointer"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const displayName = !isLoggedIn && typeof document !== "undefined"
                              ? (document.getElementById("watch-party-create-display-name") as HTMLInputElement | null)?.value?.trim() || null
                              : null;
                            const allowOffensiveWords = typeof document !== "undefined"
                              ? (document.getElementById("watch-party-allow-offensive") as HTMLInputElement | null)?.checked ?? false
                              : false;
                            onWatchPartyCreate(displayName, allowOffensiveWords);
                            setView("main");
                          }}
                          className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border bg-[var(--player-accent)]/20 border-[var(--player-accent)]/50 hover:bg-[var(--player-accent)]/30 transition-all"
                        >
                          <Icon icon="solar:play-circle-bold" className="w-5 h-5 text-white" />
                          <span className="text-white font-medium">Create Party</span>
                        </button>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="px-2 bg-black/80 text-white/60 text-xs">or join with code</span>
                          </div>
                        </div>
                        <JoinWatchPartyForm
                          onJoin={(code, displayName) => {
                            onWatchPartyJoin(code, displayName);
                            setView("main");
                          }}
                          onCancel={() => setView("main")}
                          isLoggedIn={!!isLoggedIn}
                          savedDisplayName={savedGuestDisplayName}
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60 text-sm">Room code</span>
                          <span className="text-white font-mono text-lg tracking-wider">{_watchPartyRoomId}</span>
                        </div>
                        <button
                          onClick={() => {
                            const url = `${typeof window !== "undefined" ? window.location.origin : ""}${typeof window !== "undefined" ? window.location.pathname : ""}?code=${_watchPartyRoomId}`;
                            navigator.clipboard.writeText(url).catch(() => {});
                          }}
                          className="w-full p-2.5 rounded-lg border bg-white/5 border-white/10 hover:bg-white/10 text-white/80 text-sm"
                        >
                          Copy invite link
                        </button>
                        {onOpenChat && (
                          <button
                            onClick={() => {
                              onOpenChat();
                              setView("main");
                            }}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border bg-white/5 border-white/10 hover:bg-white/10 text-white/80 text-sm"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Open Chat
                          </button>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-white/60 text-sm">Show participants overlay</span>
                          {watchPartyOverlayVisible ? (
                            <ToggleRight
                              className="w-5 h-5 text-[var(--player-accent)] cursor-pointer"
                              onClick={() => onWatchPartyOverlayToggle(false)}
                            />
                          ) : (
                            <ToggleLeft
                              className="w-5 h-5 text-white/40 cursor-pointer"
                              onClick={() => onWatchPartyOverlayToggle(true)}
                            />
                          )}
                        </div>
                        <div>
                          <h3 className="text-white font-medium text-sm mb-2">Participants ({watchPartyParticipants.length})</h3>
                          <div className="space-y-2">
                            {watchPartyParticipants.map((p) => (
                              <div
                                key={p.userId}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {p.avatar ? (
                                    <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                      <Users className="w-4 h-4 text-white/60" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="text-white text-sm font-medium truncate block">{p.displayName}</span>
                                    <span className="text-white/50 text-xs">
                                      {p.isHost ? "Host" : p.canSkip ? "Can sync & seek" : "Viewer"}
                                    </span>
                                  </div>
                                </div>
                                {watchPartyHostId === watchPartyUserId && p.userId !== watchPartyUserId && (
                                  <div className="flex items-center gap-1">
                                    {onGrantSkip && (
                                      <button
                                        onClick={() => onGrantSkip(p.userId, !p.canSkip)}
                                        className={`p-1.5 rounded-lg transition-all ${
                                          p.canSkip
                                            ? "text-[var(--player-accent)] bg-[var(--player-accent)]/20"
                                            : "text-white/50 hover:bg-white/10 hover:text-white/70"
                                        }`}
                                        title={p.canSkip ? "Revoke sync & seek" : "Allow sync & seek"}
                                      >
                                        <Icon icon="solar:play-circle-bold" className="w-4 h-4" />
                                      </button>
                                    )}
                                    {onRemoveParticipant && (
                                      <button
                                        onClick={() => onRemoveParticipant(p.userId)}
                                        className="p-1.5 rounded-lg text-red-400/80 hover:bg-red-500/20 hover:text-red-400 transition-all"
                                        title="Remove from party"
                                      >
                                        <Icon icon="solar:user-minus-bold" className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onWatchPartyLeave();
                            setView("main");
                          }}
                          className="w-full p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all mt-auto"
                        >
                          Leave party
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === "debug" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "debug"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                    <button
                      onClick={() => setView("main")}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-4 h-4 text-white group-hover:text-[var(--player-accent)] transition-colors" />
                    </button>
                    <Icon
                      icon="solar:bug-bold"
                      className="w-4 h-4 text-white"
                    />
                    <h2 className="text-white text-base font-semibold">
                      Debug
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4">
                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="text-white/60 text-xs mb-2 font-medium">
                          Server Info
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/60">API:</span>
                            <span className="text-white font-mono text-xs">
                              {sourceDisplay.subServerName
                                ? `${sourceDisplay.serverName} - ${sourceDisplay.subServerName}`
                                : sourceDisplay.serverName}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Subtitles:</span>
                            <span className="text-white font-mono text-xs">
                              {(() => {
                                try {
                                  return new URL(WYZIE_API_BASE).host;
                                } catch {
                                  return "sub.wyzie.ru";
                                }
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Qualities:</span>
                            <span className="text-white">{sources.length}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="text-white/60 text-xs mb-2 font-medium">
                          Player Stats
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/60">
                              Playing State:
                            </span>
                            <span className="text-white">
                              {playerState.isPlaying ? "Yes" : "No"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Current Time:</span>
                            <span className="text-white font-mono">
                              {playerState.currentTime.toFixed(1)}s /{" "}
                              {playerState.duration.toFixed(1)}s
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">
                              Buffered Time:
                            </span>
                            <span className="text-white font-mono">
                              {playerState.buffered.toFixed(1)}s
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Volume Level:</span>
                            <span className="text-white">
                              {(playerState.volume * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">
                              Current Quality:
                            </span>
                            <span className="text-white">
                              {currentQuality || "Auto"}
                            </span>
                          </div>
                          {playerState.error && (
                            <div className="flex justify-between">
                              <span className="text-white/60">
                                Error Message:
                              </span>
                              <span className="text-red-400 text-xs">
                                {playerState.error}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {currentSource && (
                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                          <div className="text-white/60 text-xs mb-2 font-medium">
                            Current Media
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/60">Title:</span>
                              <span className="text-white">
                                {currentSource.name}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/60">
                                Playback Speed:
                              </span>
                              <span className="text-white">
                                {currentSource.speed}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/60">File Size:</span>
                              <span className="text-white">
                                {currentSource.size}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={onDownload}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                      >
                        <span className="text-white text-sm font-medium">
                          Download
                        </span>
                        <Icon
                          icon="solar:file-download-bold"
                          className="w-4 h-4 text-white/60"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "playback" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "playback"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                    <button
                      onClick={() => setView("main")}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-4 h-4 text-white group-hover:text-[var(--player-accent)] transition-colors" />
                    </button>
                    <Icon
                      icon="solar:play-circle-bold"
                      className="w-4 h-4 text-white"
                    />
                    <h2 className="text-white text-base font-semibold">
                      Playback
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4 space-y-4">
                    {isTVShow && (
                      <div className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white text-sm font-semibold truncate">
                            Auto-next episode
                          </div>
                          <div className="text-white/60 text-xs mt-0.5">
                            Start the next episode at credits or 5 seconds
                            before the end.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAutoNextToggle(!autoNextEnabled)}
                          className="flex items-center justify-center"
                        >
                          {autoNextEnabled ? (
                            <ToggleRight className="w-6 h-6 text-[var(--player-accent)]" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-white/40" />
                          )}
                        </button>
                      </div>
                    )}

                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-white text-sm font-semibold">
                            Playback speed
                          </div>
                          <div className="text-white/60 text-xs mt-0.5">
                            Affects this device only.
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {playbackSpeeds.map((speed) => {
                          const selected = settings.playbackRate === speed;
                          return (
                            <button
                              key={speed}
                              type="button"
                              onClick={() => {
                                onPlaybackRateChange(speed);
                                setView("main");
                              }}
                              className={`px-2.5 py-1.5 rounded-md border text-center text-xs font-medium transition-all ${
                                selected
                                  ? "border-[var(--player-accent)] bg-[var(--player-accent)]/20 text-white"
                                  : "border-white/10 bg-white/0 text-white/80 hover:border-white/20 hover:bg-white/10"
                              }`}
                            >
                              {speed}x
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "servers" && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "servers"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                    <button
                      onClick={() => setView("main")}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-4 h-4 text-white group-hover:text-[var(--player-accent)] transition-colors" />
                    </button>
                    <Icon
                      icon="solar:server-square-cloud-bold"
                      className="w-4 h-4 text-white"
                    />
                    <h2 className="text-white text-base font-semibold">
                      Servers
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4 space-y-2">
                    {serverConfigs.map((server) => {
                      const hasSubServers = !!server.getSubServers;
                      const parsed = parseSelectedServer;
                      const selected =
                        parsed.serverId === server.id &&
                        !parsed.subServerName;
                      const isSelecting =
                        selectingServerId === server.id ||
                        selectingServerId?.startsWith(server.id + ":");
                      const isFailed = failedServers.has(server.id);

                      return (
                        <button
                          key={server.id}
                          onClick={() => {
                            if (hasSubServers) {
                              navigateToSubServers(server.id);
                            } else {
                              handleServerSelect(server.id);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                            selected
                              ? "border-[var(--player-accent)] bg-[var(--player-accent)]/10"
                              : "border-white/10 hover:border-white/20 hover:bg-white/10"
                          } ${isSelecting ? "opacity-70" : ""} ${
                            isFailed ? "opacity-50" : ""
                          }`}
                          disabled={isSelecting}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 ${
                                selected
                                  ? "border-[var(--player-accent)]"
                                  : "border-white/30"
                              }`}
                            />
                            <div>
                              <div className="text-white text-sm font-semibold">
                                {server.name}
                              </div>
                              <div className="text-white/60 text-xs">
                                Priority {server.order}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasSubServers && (
                              <ChevronRight className="w-4 h-4 text-white/60" />
                            )}
                            {selected ? (
                              <Icon
                                icon="solar:check-circle-bold"
                                className="w-4 h-4 text-[var(--player-accent)]"
                              />
                            ) : isSelecting ? (
                              <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              isFailed && (
                                <Icon
                                  icon="solar:close-circle-bold"
                                  className="w-4 h-4 text-red-400"
                                />
                              )
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {view === "servers-sub" && currentSubServerView && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "servers-sub"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                {(() => {
                  const server = serverConfigs.find(
                    (s) => s.id === currentSubServerView
                  );
                  const subServers =
                    subServersCache.get(currentSubServerView) || [];
                  const error = subServerErrors.get(currentSubServerView);
                  const parsed = parseSelectedServer;

                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                        <button
                          onClick={() => {
                            setView("servers");
                            setCurrentSubServerView(null);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                          aria-label="Back"
                        >
                          <ChevronLeft className="w-4 h-4 text-white group-hover:text-[var(--player-accent)] transition-colors" />
                        </button>
                        <Icon
                          icon="solar:server-square-cloud-bold"
                          className="w-4 h-4 text-white"
                        />
                        <h2 className="text-white text-base font-semibold">
                          {server?.name || "Sub-servers"}
                        </h2>
                      </div>
                      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4">
                        {error ? (
                          <div className="flex flex-col items-center justify-center py-12 px-4">
                            <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                              <Icon
                                icon="solar:folder-error-bold-duotone"
                                className="w-8 h-8 text-white/60"
                              />
                            </div>
                            <h3 className="text-white text-lg font-semibold mb-2">
                              Failed to scrape
                            </h3>
                            <p className="text-white/60 text-sm text-center max-w-sm">
                              There was an error while trying to find any
                              videos... Try a different source?
                            </p>
                          </div>
                        ) : subServers.length === 0 ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                            <span className="ml-3 text-white/60 text-sm">
                              Loading sub-servers...
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {subServers.map((subServer) => {
                              const subSelected = currentSubServerView
                                ? parsed.serverId === currentSubServerView &&
                                  parsed.subServerName === subServer.name
                                : false;
                              const subSelecting = currentSubServerView
                                ? selectingServerId ===
                                  `${currentSubServerView}:${subServer.name}`
                                : false;
                              const subFailed = currentSubServerView
                                ? failedServers.has(
                                    `${currentSubServerView}:${subServer.name}`
                                  )
                                : false;

                              return (
                                <button
                                  key={subServer.name}
                                  onClick={() => {
                                    if (currentSubServerView) {
                                      handleServerSelect(
                                        currentSubServerView,
                                        subServer.name
                                      );
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                                    subSelected
                                      ? "border-[var(--player-accent)] bg-[var(--player-accent)]/10"
                                      : "border-white/10 hover:border-white/20 hover:bg-white/10"
                                  } ${subSelecting ? "opacity-70" : ""} ${
                                    subFailed ? "opacity-50" : ""
                                  }`}
                                  disabled={subSelecting}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-5 h-5 rounded-full border-2 ${
                                        subSelected
                                          ? "border-[var(--player-accent)]"
                                          : "border-white/30"
                                      }`}
                                    />
                                    <div>
                                      <div className="text-white text-sm font-semibold">
                                        {subServer.name}
                                      </div>
                                      <div className="text-white/60 text-xs">
                                        {subServer.sources.length} source
                                        {subServer.sources.length !== 1
                                          ? "s"
                                          : ""}
                                      </div>
                                    </div>
                                  </div>
                                  {subSelected ? (
                                    <Icon
                                      icon="solar:check-circle-bold"
                                      className="w-4 h-4 text-[var(--player-accent)]"
                                    />
                                  ) : subSelecting ? (
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    subFailed && (
                                      <Icon
                                        icon="solar:close-circle-bold"
                                        className="w-4 h-4 text-red-400"
                                      />
                                    )
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {view === "server-loading" && currentLoadingServer && (
              <div
                className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  view === "server-loading"
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
                    <button
                      onClick={() => {
                        if (currentLoadingServer) {
                          setView(
                            currentLoadingServer.subServerName
                              ? "servers-sub"
                              : "servers"
                          );
                          setCurrentLoadingServer(null);
                          setServerSelectionError(null);
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                      aria-label="Back"
                    >
                      <ChevronLeft className="w-4 h-4 text-white group-hover:text-[var(--player-accent)] transition-colors" />
                    </button>
                    <Icon
                      icon="solar:server-square-cloud-bold"
                      className="w-4 h-4 text-white"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-white text-base font-semibold">
                        {currentLoadingServer.name}
                      </span>
                      {currentLoadingServer.subServerName && (
                        <span className="text-white/60 text-sm">
                          - {currentLoadingServer.subServerName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 p-4">
                    {selectingServerId !== null && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-[var(--player-accent)]/30 bg-[var(--player-accent)]/5">
                          <div className="flex-shrink-0">
                            <div className="relative w-3.5 h-3.5">
                              <div className="absolute inset-0 rounded-full border border-[var(--player-accent)]/40" />
                              <div className="absolute inset-0 rounded-full border border-transparent border-t-[var(--player-accent)] animate-spin" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[var(--player-accent)] text-xs font-medium">
                              Checking for videos...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsMenu;
