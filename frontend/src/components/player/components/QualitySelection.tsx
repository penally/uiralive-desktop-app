import React, { useMemo } from "react";
import { ChevronLeft, Check } from "lucide-react";
import type { MediaSource, PlayerState } from "../lib/types";

export interface QualitySelectionProps {
  isOpen: boolean;
  sources: MediaSource[];
  currentQuality: string;
  currentSource: MediaSource | null;
  autoQuality: boolean;
  playerState?: PlayerState;
  inline?: boolean;
  onClose: () => void;
  onQualityChange: (quality: string) => void;
  onAutoQualityToggle: (enabled: boolean) => void;
  onSwitchSource?: () => void;
}

const presetQualities = ["4K", "1080P", "720P", "480P", "360P"];

export const QualitySelection: React.FC<QualitySelectionProps> = ({
  isOpen,
  sources,
  currentQuality,
  currentSource,
  autoQuality,
  inline = false,
  onClose,
  onQualityChange,
  onAutoQualityToggle,
  onSwitchSource,
}) => {
  const hasApiQualities = useMemo(() => {
    return sources.some((s) => {
      const q = s.quality?.trim();
      return q && !presetQualities.includes(q.toUpperCase());
    });
  }, [sources]);

  const bestQuality = useMemo(() => {
    if (sources.length === 0) return null;
    return sources[0].quality;
  }, [sources]);

  const qualityList = useMemo(() => {
    if (hasApiQualities) {
      const map = new Map<string, MediaSource>();
      for (const s of sources) {
        if (!map.has(s.quality)) map.set(s.quality, s);
      }
      return Array.from(map.entries()).map(([quality, source]) => ({
        quality,
        source,
        display: quality,
        available: true,
      }));
    }

    const availableMap = new Map<string, MediaSource>();
    sources.forEach((source) => {
      const q = source.quality.toUpperCase();
      const normalized = q === "ORG" ? "4K" : q;
      if (!availableMap.has(normalized)) availableMap.set(normalized, source);
    });

    return presetQualities.map((quality) => {
      const source = availableMap.get(quality);
      return {
        quality,
        source,
        display: quality === "4K" ? "4K" : quality.replace("P", "p"),
        available: !!source,
      };
    });
  }, [hasApiQualities, sources]);

  const normalize = (q: string) => (q || "").toUpperCase().replace("ORG", "4K");

  const isSelected = (quality: string, _source?: MediaSource): boolean => {
    const qNorm = normalize(quality);
    if (autoQuality) return normalize(bestQuality ?? "") === qNorm;
    if (currentSource) return normalize(currentSource.quality) === qNorm;
    if (currentQuality) return normalize(currentQuality) === qNorm;
    return false;
  };

  if (!isOpen) return null;

  const renderList = () => (
    <div className="flex flex-col gap-0">
      {qualityList.map(({ quality, source, display, available }) => {
        const selected = isSelected(quality, source);
        const isDisabled = !available || autoQuality;

        return (
          <button
            key={quality}
            onClick={() => {
              if (!isDisabled && source) {
                onQualityChange(source.quality);
                onClose();
              }
            }}
            disabled={isDisabled}
            className={`w-full flex items-center justify-between py-3 px-1 rounded-lg transition-all duration-150 text-left
              ${available && !autoQuality ? "hover:bg-white/5" : ""}
              ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <span className={`text-sm font-medium ${selected ? "text-white" : available ? "text-white/60" : "text-white/40"}`}>
              {display}
            </span>
            {selected && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--player-accent)] flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderSwitchSourceHint = () =>
    onSwitchSource ? (
      <p className="text-xs text-white/50 mt-3 px-1">
        You can try{" "}
        <button
          type="button"
          onClick={onSwitchSource}
          className="text-[var(--player-accent)] underline underline-offset-2 hover:text-[var(--player-accent)]/90 transition-colors"
        >
          switching source
        </button>{" "}
        to get different quality options.
      </p>
    ) : null;

  const renderAutoToggle = () => (
    <button
      onClick={() => onAutoQualityToggle(!autoQuality)}
      className="w-full flex items-center justify-between py-3 px-1 rounded-lg transition-all duration-150 hover:bg-white/5"
    >
      <span className="text-sm font-medium text-white">Automatic quality</span>
      <div
        className={`relative rounded-full transition-all duration-200 ${autoQuality ? "bg-[var(--player-accent)]" : "bg-white/20"}`}
        style={{ width: 40, height: 22 }}
      >
        <div
          className="absolute top-1 rounded-full bg-white shadow-sm transition-all duration-200"
          style={{ width: 18, height: 18, left: autoQuality ? 20 : 2, top: 2 }}
        />
      </div>
    </button>
  );

  if (inline) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-white text-base font-semibold">Quality</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 flex flex-col">
          {renderList()}
          <div className="h-px bg-white/10 my-2" />
          {renderAutoToggle()}
          {renderSwitchSourceHint()}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
        <div
          className="bg-black/40 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-full max-w-md max-h-[calc(100vh-24px)] mx-4 pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-white text-lg font-semibold">Quality</h2>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 flex flex-col">
            {renderList()}
            <div className="h-px bg-white/10 my-2" />
            {renderAutoToggle()}
            {renderSwitchSourceHint()}
          </div>
        </div>
      </div>
    </>
  );
};

export default QualitySelection;
