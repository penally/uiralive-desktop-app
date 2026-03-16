import React, { useState, useRef, useEffect, useMemo } from "react";
import type { PlayerState } from "../lib/types";
import VolumeSlider from "./VolumeSlider";
import { Icon } from "@iconify/react";

export interface PlayerControlsProps {
  playerState: PlayerState;
  videoElement?: HTMLVideoElement | null;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSeekRelative: (seconds: number) => void;
  onToggleFullscreen: () => void;
  onToggleSettings: () => void;
  onToggleCaptions: () => void;
  onOpenSubtitleMenu?: () => void;
  isSubtitleMenuOpen?: boolean;
  hasSubtitles?: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onCast?: () => void;
  onSkipIntro?: () => void;
  onSkipRecap?: () => void;
  onSkipCredits?: () => void;
  onNextEpisode?: () => void;
  skipIntroVisible?: boolean;
  skipRecapVisible?: boolean;
  skipCreditsVisible?: boolean;
  onToggleEpisodes?: () => void;
  isTVShow?: boolean;
  isEpisodesMenuOpen?: boolean;
  isSettingsOpen?: boolean;
  bindSettingsButton?: React.MutableRefObject<HTMLButtonElement | null>;
  bindControlsBar?: React.MutableRefObject<HTMLDivElement | null>;
  bindEpisodesButton?: HTMLButtonElement | null;
  bindSubtitleButton?: React.MutableRefObject<HTMLButtonElement | null>;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  playerState,
  videoElement: _videoElement,
  onPlayPause,
  onSeek,
  onSeekRelative,
  onToggleFullscreen,
  onToggleSettings,
  onToggleCaptions,
  onOpenSubtitleMenu,
  isSubtitleMenuOpen = false,
  hasSubtitles = false,
  onVolumeChange,
  onToggleMute,
  onCast,
  onSkipIntro,
  onSkipRecap,
  onSkipCredits,
  onNextEpisode,
  skipIntroVisible = false,
  skipRecapVisible = false,
  skipCreditsVisible = false,
  onToggleEpisodes,
  isTVShow = false,
  isEpisodesMenuOpen = false,
  isSettingsOpen = false,
  bindSettingsButton,
  bindControlsBar,
  bindEpisodesButton: _bindEpisodesButton,
  bindSubtitleButton,
}) => {
  const [seekPosition, setSeekPosition] = useState({
    x: 0,
    time: 0,
    visible: false,
  });
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [endTimeVisible, setEndTimeVisible] = useState(false);
  const [volumeSliderVisible, setVolumeSliderVisible] = useState(false);

  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const controlsBarRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const episodesButtonRef = useRef<HTMLButtonElement | null>(null);
  const subtitleButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (bindSettingsButton && settingsButtonRef.current) {
      bindSettingsButton.current = settingsButtonRef.current;
    }
    if (bindControlsBar !== undefined && controlsBarRef.current) {
      (bindControlsBar as React.MutableRefObject<HTMLElement | null>).current = controlsBarRef.current;
    }
    if (bindSubtitleButton && subtitleButtonRef.current) {
      bindSubtitleButton.current = subtitleButtonRef.current;
    }
  }, [bindSettingsButton, bindControlsBar, bindSubtitleButton]);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatEndTime = (seconds: number): string => {
    if (!isFinite(seconds)) return "";
    const now = new Date();
    const endTime = new Date(
      now.getTime() + (seconds - playerState.currentTime) * 1000
    );
    const hours = endTime.getHours();
    const minutes = endTime.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const updateSeekFromPointer = (
    event: React.PointerEvent,
    commit = false
  ) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clampedX = Math.max(
      rect.left,
      Math.min(rect.right, event.clientX)
    );
    const percent = Math.max(
      0,
      Math.min(1, (clampedX - rect.left) / rect.width)
    );
    const time = percent * playerState.duration;

    setSeekPosition({ x: clampedX - rect.left, time, visible: true });
    if (commit) {
      onSeek(time);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    setActivePointerId(event.pointerId);
    setIsScrubbing(true);
    progressBarRef.current.setPointerCapture(event.pointerId);
    updateSeekFromPointer(event, true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    if (isScrubbing && event.pointerId === activePointerId) {
      event.preventDefault();
      updateSeekFromPointer(event, true);
    } else if (!isScrubbing) {
      updateSeekFromPointer(event, false);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    if (event.pointerId === activePointerId) {
      progressBarRef.current.releasePointerCapture(event.pointerId);
      setActivePointerId(null);
      setIsScrubbing(false);
      setSeekPosition((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleSeekLeave = () => {
    if (isScrubbing) return;
    setSeekPosition((prev) => ({ ...prev, visible: false }));
  };

  const progressPercent = useMemo(
    () =>
      playerState.duration > 0
        ? (playerState.currentTime / playerState.duration) * 100
        : 0,
    [playerState.currentTime, playerState.duration]
  );

  const toggleEndTime = () => {
    setEndTimeVisible(!endTimeVisible);
  };

  const handleVolumeButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    onToggleMute();
  };

  const handleCast = () => {
    if (onCast) {
      onCast();
      return;
    }

    const videoElement = document.querySelector("video");

    if (!videoElement) {
      console.error("No video element found");
      return;
    }

    if ("remote" in videoElement) {
      (videoElement as any).remote.prompt().catch((err: any) => {
        console.log("Cast prompt cancelled or unavailable:", err);
      });
    } else {
      console.log("Remote playback not supported in this browser");
    }
  };

  const isMuted = playerState.volume === 0;

  return (
    <div
      ref={controlsBarRef}
      className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-200 overflow-visible ${
        playerState.isControlsVisible
          ? "opacity-100"
          : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const isVolumeControl = target.closest("[data-volume-control]");
        if (volumeSliderVisible && !isVolumeControl) {
          setVolumeSliderVisible(false);
        }
      }}
    >
      <div className="px-3 sm:px-4 pt-3 pb-2 relative">
        {(skipIntroVisible || skipRecapVisible || skipCreditsVisible) && (
          <div
            className="absolute bottom-full left-0 right-0 flex items-center gap-2 pointer-events-none z-10 justify-center sm:justify-end px-4 sm:px-8"
            style={{ marginBottom: isSettingsOpen ? "88px" : "16px" }}
          >
            {((skipIntroVisible && onSkipIntro) ||
              (skipRecapVisible && onSkipRecap)) && (
              <div className="flex items-center gap-2">
                {skipIntroVisible && onSkipIntro && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkipIntro();
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-base font-bold hover:bg-gray-100 transition-all pointer-events-auto shadow-lg"
                  >
                    <Icon
                      icon="solar:skip-next-bold-duotone"
                      className="w-5 h-5"
                    />
                    <span>Skip Intro</span>
                  </button>
                )}
                {skipRecapVisible && onSkipRecap && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkipRecap();
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-base font-bold hover:bg-gray-100 transition-all pointer-events-auto shadow-lg"
                  >
                    <Icon
                      icon="solar:skip-next-bold-duotone"
                      className="w-5 h-5"
                    />
                    <span>Skip Recap</span>
                  </button>
                )}
              </div>
            )}

            {skipCreditsVisible && (onSkipCredits || onNextEpisode) && (
              <div className="flex items-center gap-2">
                {onSkipCredits && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkipCredits();
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-base font-bold hover:bg-gray-100 transition-all pointer-events-auto shadow-lg"
                  >
                    <Icon
                      icon="solar:skip-next-bold-duotone"
                      className="w-5 h-5"
                    />
                    <span>Skip Credits</span>
                  </button>
                )}

                {onNextEpisode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNextEpisode();
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--player-accent)] text-black text-base font-bold hover:bg-[var(--player-accent)]/90 transition-all pointer-events-auto shadow-lg"
                  >
                    <Icon
                      icon="solar:skip-next-bold-duotone"
                      className="w-5 h-5"
                    />
                    <span>Next Episode</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div
          ref={progressBarRef}
          className="w-full h-1.5 sm:h-1 bg-white/20 rounded-full cursor-pointer group relative touch-none overflow-visible"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handleSeekLeave}
          role="progressbar"
          aria-valuenow={playerState.currentTime}
          aria-valuemin={0}
          aria-valuemax={playerState.duration}
        >
          {seekPosition.visible && (
            <div
              className="absolute pointer-events-none z-[70] flex flex-col items-center gap-1 -translate-x-1/2 transition-[left] duration-75"
              style={{
                left: `${Math.max(28, Math.min(seekPosition.x, (progressBarRef.current?.getBoundingClientRect().width ?? 9999) - 28))}px`,
                bottom: 'calc(100% + 10px)',
              }}
            >
              <div className="bg-black/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/15 shadow-xl backdrop-blur-md">
                {formatTime(seekPosition.time)}
              </div>
              <div className="h-2.5 w-px bg-white/50 rounded-full" />
            </div>
          )}

          <div className="relative h-full rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
              style={{
                width: `${
                  playerState.duration > 0
                    ? (playerState.buffered / playerState.duration) * 100
                    : 0
                }%`,
              }}
            />
            <div
              className="absolute top-0 left-0 h-full bg-[var(--player-accent)] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white/70 bg-[var(--player-accent)] shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-all duration-150 ${
              seekPosition.visible ? "opacity-0 scale-90" : ""
            }`}
            style={{ left: `${progressPercent}%` }}
          />
          {seekPosition.visible && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full border-2 border-white bg-[var(--player-accent)] shadow-[0_6px_18px_rgba(0,0,0,0.6)] pointer-events-none"
              style={{ left: `${seekPosition.x}px` }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 sm:px-4 pb-2 sm:pb-3 gap-2 sm:gap-3 overflow-visible">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => onSeekRelative(-10)}
            className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation"
            aria-label="Rewind 10 seconds"
          >
            <Icon
              icon="solar:rewind-back-bold-duotone"
              className="w-6 h-6 sm:w-6 sm:h-6"
            />
          </button>

          <button
            onClick={onPlayPause}
            className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation"
            aria-label={playerState.isPlaying ? "Pause" : "Play"}
          >
            {playerState.isPlaying ? (
              <Icon
                icon="solar:pause-bold"
                className="w-6 h-6 sm:w-6 sm:h-6"
              />
            ) : (
              <Icon
                icon="solar:play-bold"
                className="w-6 h-6 sm:w-6 sm:h-6 ml-0.5"
              />
            )}
          </button>

          <button
            onClick={() => onSeekRelative(10)}
            className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation"
            aria-label="Forward 10 seconds"
          >
            <Icon
              icon="solar:rewind-forward-bold-duotone"
              className="w-6 h-6 sm:w-6 sm:h-6"
            />
          </button>

          <div
            className="flex items-center gap-2 data-volume-control transition-all duration-200 ease-out"
            data-volume-control
            onMouseEnter={() => setVolumeSliderVisible(true)}
            onMouseLeave={() => setVolumeSliderVisible(false)}
          >
            <button
              onClick={handleVolumeButtonClick}
              className={`flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation flex-shrink-0 ${
                volumeSliderVisible ? "bg-[var(--player-accent)]/20 rounded-lg" : ""
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
              data-volume-control
            >
              {isMuted ? (
                <Icon icon="solar:volume-cross-bold" className="w-6 h-6" />
              ) : (
                <Icon icon="solar:volume-loud-bold" className="w-6 h-6" />
              )}
            </button>
            <div
              className="overflow-visible transition-all duration-200 ease-out"
              style={{
                width: volumeSliderVisible ? "140px" : "0",
                opacity: volumeSliderVisible ? "1" : "0",
              }}
            >
              {volumeSliderVisible && (
                <VolumeSlider
                  state={playerState}
                  onVolumeChange={onVolumeChange}
                />
              )}
            </div>
          </div>

          <div className="text-white/40 text-sm mx-1 hidden sm:block">|</div>

          <button
            onClick={toggleEndTime}
            className="text-white text-xs font-semibold sm:text-sm font-medium hover:text-white/80 active:opacity-70 transition-colors touch-manipulation px-1"
          >
            {endTimeVisible ? (
              <>Ends at {formatEndTime(playerState.duration)}</>
            ) : (
              <>
                {formatTime(playerState.currentTime)}&nbsp;
                <span className="text-white/60 font-semibold">/</span>&nbsp;
                {formatTime(playerState.duration)}
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isTVShow && onToggleEpisodes && (
            <button
              ref={episodesButtonRef}
              onClick={onToggleEpisodes}
              className={`flex items-center gap-2 px-4 py-2 text-white hover:text-white/80 active:opacity-70 transition-colors touch-manipulation ${
                isEpisodesMenuOpen ? "text-[var(--player-accent)]" : ""
              }`}
              aria-label="Episodes"
            >
              <Icon icon="solar:album-outline" className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">
                Episodes
              </span>
            </button>
          )}

          <button
            ref={subtitleButtonRef}
            onClick={onOpenSubtitleMenu ?? onToggleCaptions}
            className={`hidden sm:flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 active:scale-95 hover:scale-110 transition-transform touch-manipulation relative ${
              isSubtitleMenuOpen
                ? "text-[var(--player-accent)]"
                : playerState.isControlsVisible && hasSubtitles
                ? "text-white"
                : "text-white/70"
            }`}
            aria-label="Subtitles"
          >
            <Icon icon="solar:subtitles-bold" className="w-6 h-6 sm:w-6 sm:h-6" />
            {hasSubtitles && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--player-accent)] border border-black/40" />
            )}
          </button>

          <button
            onClick={handleCast}
            className="hidden sm:flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation"
            aria-label="Cast to device"
          >
            <Icon
              icon="solar:screencast-2-bold"
              className="w-6 h-6 sm:w-6 sm:h-6"
            />
          </button>

          <button
            ref={settingsButtonRef}
            onClick={onToggleSettings}
            className={`flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation ${
              playerState.isSettingsOpen ? "text-[var(--player-accent)]" : ""
            }`}
            aria-label="Settings"
          >
            <Icon
              icon="solar:settings-bold"
              className="w-6 h-6 sm:w-6 sm:h-6"
            />
          </button>

          <button
            onClick={onToggleFullscreen}
            className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 text-white active:scale-95 hover:scale-110 transition-transform touch-manipulation"
            aria-label={
              playerState.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
            }
          >
            {playerState.isFullscreen ? (
              <Icon
                icon="solar:minimize-square-minimalistic-bold"
                className="w-6 h-6 sm:w-6 sm:h-6"
              />
            ) : (
              <Icon
                icon="solar:maximize-square-minimalistic-bold"
                className="w-6 h-6 sm:w-6 sm:h-6"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
