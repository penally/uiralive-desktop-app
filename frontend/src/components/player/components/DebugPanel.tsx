import React from "react";
import { X } from "lucide-react";
import type { PlayerState, MediaSource } from "../lib/types";

export interface DebugPanelProps {
  isOpen: boolean;
  state: PlayerState;
  sources: MediaSource[];
  currentSource: MediaSource | null;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  state,
  sources,
  currentSource,
  onClose,
}) => {
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-white text-xl font-semibold">
            Debug Information
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            aria-label="Close debug panel"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-black/50 rounded-lg p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-3">Player State</h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-white/60">Playing:</span>
                <span className="text-white">
                  {state.isPlaying ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Current Time:</span>
                <span className="text-white">
                  {state.currentTime.toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Duration:</span>
                <span className="text-white">{state.duration.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Buffered:</span>
                <span className="text-white">{state.buffered.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Volume:</span>
                <span className="text-white">
                  {(state.volume * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Fullscreen:</span>
                <span className="text-white">
                  {state.isFullscreen ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Loading:</span>
                <span className="text-white">
                  {state.loading ? "Yes" : "No"}
                </span>
              </div>
              {state.error && (
                <div className="flex justify-between">
                  <span className="text-white/60">Error:</span>
                  <span className="text-red-400">{state.error}</span>
                </div>
              )}
            </div>
          </div>

          {currentSource && (
            <div className="bg-black/50 rounded-lg p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3">Current Source</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-white/60">Quality:</span>
                  <span className="text-white">{currentSource.quality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Name:</span>
                  <span className="text-white">{currentSource.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Speed:</span>
                  <span className="text-white">{currentSource.speed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Size:</span>
                  <span className="text-white">{currentSource.size}</span>
                </div>
                <div className="mt-2">
                  <span className="text-white/60 block mb-1">URL:</span>
                  <code className="text-xs text-white/80 break-all">
                    {currentSource.url.substring(0, 100)}...
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="bg-black/50 rounded-lg p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-3">
              Available Sources ({sources.length})
            </h3>
            <div className="space-y-2">
              {sources.map((source, index) => (
                <div
                  key={index}
                  className={`text-sm p-2 rounded bg-white/5 ${
                    source.quality === state.quality
                      ? "border border-[var(--player-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">
                      {source.name}
                    </span>
                    <span className="text-white/60 text-xs">
                      {source.quality}
                    </span>
                  </div>
                  <div className="text-white/60 text-xs mt-1">
                    {source.speed} • {source.size}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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

        .play-btn {
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

export default DebugPanel;
