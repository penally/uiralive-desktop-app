import React, { useMemo } from "react";

export interface PauseScreenProps {
  isVisible: boolean;
  onPlay: () => void;
  mediaTitle?: string | null;
  currentTime: number;
  duration: number;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
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

export const PauseScreen: React.FC<PauseScreenProps> = ({
  isVisible,
  onPlay,
  mediaTitle,
  currentTime,
  duration,
}) => {
  const progressPercent = useMemo(
    () => (duration > 0 ? (currentTime / duration) * 100 : 0),
    [currentTime, duration]
  );

  const formattedTime = useMemo(() => formatTime(currentTime), [currentTime]);
  const formattedDuration = useMemo(() => formatTime(duration), [duration]);

  if (!isVisible) return null;

  return (
    <div
      className="pause-overlay absolute inset-0 z-50 flex items-end justify-between transition-opacity duration-300"
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
    >
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="scrim pointer-events-none absolute inset-0" />

      <div className="info-panel relative z-10 flex flex-col gap-3 p-6 sm:p-10">
        {mediaTitle && (
          <>
            <p className="media-eyebrow text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Now Paused
            </p>
            <h2 className="media-title text-2xl font-black leading-tight text-white drop-shadow-2xl sm:text-4xl">
              {mediaTitle}
            </h2>
          </>
        )}

        {duration > 0 && (
          <div className="mt-1 flex flex-col gap-2">
            <div className="progress-track h-[3px] w-64 overflow-hidden rounded-full bg-white/20 sm:w-80">
              <div
                className="progress-fill h-full rounded-full bg-[var(--player-accent)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span className="font-medium text-white">{formattedTime}</span>
              <span className="text-white/30">/</span>
              <span>{formattedDuration}</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pause-overlay {
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .vignette {
          background: radial-gradient(
            ellipse at center,
            transparent 40%,
            rgba(0, 0, 0, 0.75) 100%
          );
        }

        .scrim {
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.85) 0%,
            rgba(0, 0, 0, 0.4) 30%,
            transparent 60%
          );
        }

        .info-panel {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .progress-fill {
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
          transition: width 0.1s linear;
        }

        .media-eyebrow {
          animation: fadeIn 0.3s ease 0.05s both;
        }

        .media-title {
          animation: fadeIn 0.3s ease 0.1s both;
          text-shadow: 0 2px 20px rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </div>
  );
};

export default PauseScreen;
