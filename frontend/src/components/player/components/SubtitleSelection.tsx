import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Ear,
} from "lucide-react";
import type { SubtitleTrack, PlayerSettings } from "../lib/types";
import { cn } from "@/lib/utils";

export interface SubtitleSelectionProps {
  isOpen: boolean;
  subtitleTracks: SubtitleTrack[];
  currentSubtitle: SubtitleTrack | null;
  inline?: boolean;
  settings?: PlayerSettings;
  anchorRef?: HTMLElement | null;
  controlsBarRef?: HTMLElement | null;
  onClose: () => void;
  onSubtitleChange: (track: SubtitleTrack | null) => void;
  onSettingsChange?: (key: keyof PlayerSettings, value: unknown) => void;
}

const SUBTITLE_SIZES: { label: string; px: number }[] = [
  { label: "XS", px: 14 }, { label: "S", px: 18 }, { label: "S+", px: 21 },
  { label: "M", px: 24 }, { label: "M+", px: 28 }, { label: "L", px: 32 },
  { label: "XL", px: 38 }, { label: "XXL", px: 46 },
];

const SUBTITLE_COLORS = [
  { color: "#FFFFFF", label: "White" }, { color: "#FFD700", label: "Yellow" },
  { color: "#00FFFF", label: "Cyan" }, { color: "#00FF7F", label: "Green" },
  { color: "#FF69B4", label: "Magenta" }, { color: "#FF4444", label: "Red" },
];

const SUBTITLE_BG_COLORS = [
  { color: "#000000", label: "Black" }, { color: "#333333", label: "Dark Gray" },
  { color: "#666666", label: "Gray" }, { color: "#FFFFFF", label: "White" },
];

const SUBTITLE_FONTS = [
  { value: "Default", label: "Default" }, { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" }, { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" }, { value: "Verdana", label: "Verdana" },
  { value: "Georgia", label: "Georgia" }, { value: "Comic Sans MS", label: "Comic Sans MS" },
  { value: "Impact", label: "Impact" },
];

const SUBTITLE_WEIGHTS = [
  { value: "normal", label: "Normal" }, { value: "bold", label: "Bold" },
];

const SUBTITLE_STYLES = [
  { value: "normal", label: "Normal" }, { value: "italic", label: "Italic" },
];

const SUBTITLE_DECORATIONS = [
  { value: "none", label: "None" }, { value: "underline", label: "Underline" },
];

const pxToSizeLabel = (px: number): string => {
  const closest = SUBTITLE_SIZES.reduce((prev, curr) => Math.abs(curr.px - px) < Math.abs(prev.px - px) ? curr : prev);
  return closest.label;
};

const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const langCodeToName: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", "pt-BR": "Portuguese (BR)", ru: "Russian", ja: "Japanese",
  ko: "Korean", zh: "Chinese", ar: "Arabic", nl: "Dutch", pl: "Polish",
  tr: "Turkish", sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish",
  cs: "Czech", ro: "Romanian", el: "Greek", hu: "Hungarian", th: "Thai",
  vi: "Vietnamese", id: "Indonesian", he: "Hebrew", hi: "Hindi", bs: "Bosnian",
  bg: "Bulgarian", hr: "Croatian", uk: "Ukrainian", sk: "Slovak",
};

const getLanguageDisplayName = (track: SubtitleTrack): string => {
  const display = track.display || track.label || track.language || "";
  if (display && langCodeToName[display.toLowerCase()]) {
    return langCodeToName[display.toLowerCase()];
  }
  const code = (track.language || track.srclang || "und").toLowerCase();
  return langCodeToName[code] || display || code.toUpperCase();
};

export const SubtitleSelection: React.FC<SubtitleSelectionProps> = ({
  isOpen,
  subtitleTracks,
  currentSubtitle,
  inline = false,
  settings,
  anchorRef,
  controlsBarRef,
  onClose,
  onSubtitleChange,
  onSettingsChange,
}) => {
  const [view, setView] = useState<"list" | "style" | "language">("list");
  const [selectedLanguageGroup, setSelectedLanguageGroup] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number; height: number; width: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const initialBgOpacity = (settings as any)?.subtitleBgOpacity != null
    ? Math.round(((settings as any).subtitleBgOpacity / 0.75) * 100)
    : 100;
  const [styleSettings, setStyleSettings] = useState({
    sizeLabel: pxToSizeLabel(settings?.subtitleSize || 24),
    fontFamily: (settings as any)?.subtitleFontFamily || "Default",
    fontWeight: (settings as any)?.subtitleFontWeight || "normal",
    fontStyle: (settings as any)?.subtitleFontStyle || "normal",
    textDecoration: (settings as any)?.subtitleTextDecoration || "none",
    fontColor: settings?.subtitleColor || "#FFFFFF",
    bgColor: settings?.subtitleBackground || "#000000",
    bgOpacity: (settings as any)?.subtitleOpacity ?? initialBgOpacity,
    subtitleBgEnabled: (settings as any)?.subtitleBgEnabled ?? true,
    subtitleAutoDetect: (settings as any)?.subtitleAutoDetect ?? true,
    subtitleSize: settings?.subtitleSize || 24,
    subtitleDelay: (settings as any)?.subtitleDelay ?? 0,
    fixSubtitles: (settings as any)?.fixSubtitles ?? true,
    fixCapitalization: (settings as any)?.fixCapitalization ?? false,
  });

  useEffect(() => {
    if (!isOpen) {
      setView("list");
      setSelectedLanguageGroup(null);
      setPopupPosition(null);
    }
  }, [isOpen]);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current && settings) {
      const bgOpacity = (settings as any)?.subtitleBgOpacity != null
        ? Math.round(((settings as any).subtitleBgOpacity / 0.75) * 100)
        : 100;
      setStyleSettings({
        sizeLabel: pxToSizeLabel(settings.subtitleSize || 24),
        fontFamily: (settings as any)?.subtitleFontFamily || "Default",
        fontWeight: (settings as any)?.subtitleFontWeight || "normal",
        fontStyle: (settings as any)?.subtitleFontStyle || "normal",
        textDecoration: (settings as any)?.subtitleTextDecoration || "none",
        fontColor: settings.subtitleColor || "#FFFFFF",
        bgColor: settings.subtitleBackground || "#000000",
        bgOpacity: (settings as any)?.subtitleOpacity ?? bgOpacity,
        subtitleBgEnabled: (settings as any)?.subtitleBgEnabled ?? true,
        subtitleAutoDetect: (settings as any)?.subtitleAutoDetect ?? true,
        subtitleSize: settings.subtitleSize || 24,
        subtitleDelay: (settings as any)?.subtitleDelay ?? 0,
        fixSubtitles: (settings as any)?.fixSubtitles ?? true,
        fixCapitalization: (settings as any)?.fixCapitalization ?? false,
      });
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, settings]);

  useEffect(() => {
    if (isOpen && !inline && (anchorRef || controlsBarRef)) {
      const updatePosition = () => {
        const controlsRect = controlsBarRef?.getBoundingClientRect();
        const anchorRect = anchorRef?.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const progressBarTop = controlsRect?.top ?? (anchorRect ? anchorRect.top - 56 : vh - 80);
        const gap = 6;
        const maxMenuHeight = progressBarTop - gap - 8;
        const menuHeight = Math.min(500, maxMenuHeight);
        const menuWidth = Math.min(380, vw - 24);
        const top = Math.max(8, progressBarTop - menuHeight - gap);
        const left = controlsRect
          ? Math.max(8, controlsRect.right - menuWidth)
          : anchorRect
            ? Math.min(vw - menuWidth - 8, anchorRect.right - menuWidth)
            : vw - menuWidth - 8;
        setPopupPosition({ top, left, height: menuHeight, width: menuWidth });
      };
      updatePosition();
      const rafId = requestAnimationFrame(updatePosition);
      window.addEventListener("resize", updatePosition);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", updatePosition);
      };
    } else if (!inline && !anchorRef && !controlsBarRef) {
      setPopupPosition(null);
    }
  }, [isOpen, anchorRef, controlsBarRef, inline]);

  const tracksByLanguage = useMemo(() => {
    const map = new Map<string, SubtitleTrack[]>();
    for (const track of subtitleTracks) {
      const key = (track.language || track.srclang || track.display || track.label || "und").toLowerCase();
      const list = map.get(key) || [];
      list.push(track);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .map(([key, tracks]) => ({
        key,
        displayName: getLanguageDisplayName(tracks[0]),
        tracks,
        flagUrl: tracks[0].flagUrl,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [subtitleTracks]);

  const defaultOrFirstTrack = subtitleTracks.find((t) => t.default) ?? subtitleTracks[0];
  const isAutoSelect =
    !!currentSubtitle && !!defaultOrFirstTrack && defaultOrFirstTrack.id === currentSubtitle.id;

  const updateStyle = (key: string, value: unknown) => {
    setStyleSettings((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "sizeLabel") {
        const px = SUBTITLE_SIZES.find((s) => s.label === value)?.px ?? 32;
        next.subtitleSize = px;
      }
      return next;
    });
    if (onSettingsChange) {
      if (key === "sizeLabel") {
        const px = SUBTITLE_SIZES.find((s) => s.label === value)?.px ?? 32;
        onSettingsChange("subtitleSize" as keyof PlayerSettings, px);
      } else if (key === "fontColor") {
        onSettingsChange("subtitleColor", value as string);
      } else if (key === "bgColor") {
        onSettingsChange("subtitleBackground", value as string);
      } else if (key === "bgOpacity") {
        const opacity = Number(value);
        onSettingsChange("subtitleOpacity" as keyof PlayerSettings, opacity);
        onSettingsChange("subtitleBgOpacity" as keyof PlayerSettings, styleSettings.subtitleBgEnabled ? (opacity / 100) * 0.75 : 0);
      } else if (key === "subtitleBgEnabled") {
        const enabled = Boolean(value);
        onSettingsChange("subtitleBgEnabled" as keyof PlayerSettings, enabled);
        onSettingsChange("subtitleBgOpacity" as keyof PlayerSettings, enabled ? (styleSettings.bgOpacity / 100) * 0.75 : 0);
      } else if (key === "subtitleAutoDetect") {
        onSettingsChange("subtitleAutoDetect" as keyof PlayerSettings, value);
      } else if (key === "fontFamily") {
        onSettingsChange("subtitleFontFamily" as keyof PlayerSettings, value);
      } else if (key === "fontWeight" || key === "fontStyle" || key === "textDecoration") {
        const map: Record<string, keyof PlayerSettings> = { fontWeight: "subtitleFontWeight", fontStyle: "subtitleFontStyle", textDecoration: "subtitleTextDecoration" };
        onSettingsChange(map[key], value);
      } else if (key === "subtitleDelay" || key === "subtitleSize" || key === "fixSubtitles" || key === "fixCapitalization") {
        onSettingsChange(key as keyof PlayerSettings, value);
      }
    }
  };

  const previewStyle = useMemo(() => {
    const fontFamily = styleSettings.fontFamily === "Default" ? "Arial" : styleSettings.fontFamily;
    const bgRgba = styleSettings.subtitleBgEnabled && styleSettings.bgColor?.startsWith?.("#") && styleSettings.bgColor.length >= 7
      ? hexToRgba(styleSettings.bgColor, (styleSettings.bgOpacity / 100) * 0.75)
      : "transparent";
    return {
      fontFamily,
      fontWeight: styleSettings.fontWeight === "bold" ? 700 : 400,
      fontStyle: styleSettings.fontStyle === "italic" ? "italic" : "normal",
      textDecoration: styleSettings.textDecoration === "underline" ? "underline" : "none",
      fontSize: `${styleSettings.subtitleSize}px`,
      color: styleSettings.fontColor,
      backgroundColor: bgRgba,
    };
  }, [styleSettings]);

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} aria-pressed={on} className={cn("relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none", on ? "bg-white" : "bg-white/15")}>
      <div className={cn("absolute top-[3px] w-3.5 h-3.5 rounded-full shadow-sm transition-all duration-200", on ? "left-[18px] bg-black" : "left-[3px] bg-white/60")} />
    </button>
  );

  if (!isOpen) return null;

  const renderStyleView = () => {
    const currentSizePx = styleSettings.subtitleSize;
    return (
      <>
        <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-3 pb-2 border-b border-white/10">
          <button onClick={() => setView("list")} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all group" aria-label="Back">
            <ChevronLeft className="w-4 h-4 text-white group-hover:text-[var(--player-accent)] transition-colors" />
          </button>
          <h2 className="text-white text-sm font-semibold flex-1">Subtitle Style</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-3">
          <div className="relative rounded-xl overflow-hidden flex-shrink-0" style={{ height: 90, background: "linear-gradient(135deg, #0d0d18 0%, #0e2240 40%, #1a0e30 70%, #0d0d18 100%)" }}>
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px" }} />
            <div className="absolute inset-0 flex items-end justify-center pb-4">
              <span className="px-3 py-1 rounded text-center max-w-[85%] leading-snug" style={{ ...previewStyle, fontSize: Math.min(currentSizePx * 0.45, 14) }}>Here is a preview of your subtitles</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Size</span>
            <div className="flex gap-1.5">
              {SUBTITLE_SIZES.map(({ label }) => (
                <button key={label} onClick={() => updateStyle("sizeLabel", label)} className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150", styleSettings.sizeLabel === label ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]")}>{label}</button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2.5">Colour</span>
            <div className="flex items-center gap-2.5">
              {SUBTITLE_COLORS.map(({ color, label }) => (
                <button key={color} onClick={() => updateStyle("fontColor", color)} title={label}
                  className={cn("w-8 h-8 rounded-full border-[1.5px] transition-all duration-150 flex items-center justify-center flex-shrink-0", styleSettings.fontColor === color ? "scale-110" : "border-transparent hover:scale-105 opacity-60 hover:opacity-90")}
                  style={{ backgroundColor: color, borderColor: styleSettings.fontColor === color ? color === "#FFFFFF" ? "rgba(255,255,255,0.9)" : color : "transparent", boxShadow: styleSettings.fontColor === color ? `0 0 0 2px rgba(255,255,255,0.25), 0 0 10px ${color}66` : "none" }}>
                  {styleSettings.fontColor === color && <Check className="w-3.5 h-3.5" style={{ color: color === "#FFFFFF" ? "#000" : "#fff" }} strokeWidth={3} />}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-0.5" />
              <label title="Custom colour" className="relative w-8 h-8 rounded-full flex-shrink-0 cursor-pointer flex items-center justify-center border-[1.5px] transition-all duration-150 overflow-hidden hover:scale-105"
                style={{ backgroundColor: styleSettings.fontColor, borderColor: !SUBTITLE_COLORS.some(c => c.color === styleSettings.fontColor) ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)", boxShadow: !SUBTITLE_COLORS.some(c => c.color === styleSettings.fontColor) ? `0 0 0 2px rgba(255,255,255,0.25), 0 0 10px ${styleSettings.fontColor}66` : "none" }}>
                {!SUBTITLE_COLORS.some(c => c.color === styleSettings.fontColor) && <Check className="w-3.5 h-3.5 relative z-10" style={{ color: styleSettings.fontColor === "#FFFFFF" ? "#000" : "#fff" }} strokeWidth={3} />}
                {SUBTITLE_COLORS.some(c => c.color === styleSettings.fontColor) && <svg className="w-3.5 h-3.5 relative z-10 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: styleSettings.fontColor === "#FFFFFF" ? "#000" : "#fff" }}><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>}
                <input type="color" value={styleSettings.fontColor} onChange={(e) => updateStyle("fontColor", e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
            </div>
            <div className="mt-2.5 flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1.5">
              <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-white/20" style={{ backgroundColor: styleSettings.fontColor || "#FFFFFF" }} />
              <span className="text-white/30 text-xs font-mono">#</span>
              <input type="text" value={(styleSettings.fontColor || "#FFFFFF").replace("#", "")} maxLength={6}
                onChange={(e) => { const raw = e.target.value.replace(/[^0-9a-fA-F]/g, ""); if (raw.length === 6) updateStyle("fontColor", "#" + raw.toUpperCase()); else setStyleSettings(prev => ({ ...prev, fontColor: raw ? "#" + raw.toUpperCase() : "#FFFFFF" })); }}
                onBlur={(e) => { const raw = e.target.value.replace(/[^0-9a-fA-F]/g, ""); if (raw.length === 6) updateStyle("fontColor", "#" + raw.toUpperCase()); else if (raw.length > 0) setStyleSettings(prev => ({ ...prev, fontColor: "#" + raw.toUpperCase() })); }}
                placeholder="FFFFFF" className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder-white/20 outline-none min-w-0" />
            </div>
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2 mt-4">Background Colour</span>
            <div className="flex items-center gap-2 flex-wrap">
              {SUBTITLE_BG_COLORS.map(({ color, label }) => (
                <button key={color} onClick={() => updateStyle("bgColor", color)} title={label}
                  className={cn("w-8 h-8 rounded-full border-[1.5px] transition-all flex-shrink-0 flex items-center justify-center", styleSettings.bgColor === color ? "scale-110 border-white/60" : "border-transparent hover:scale-105 opacity-70 hover:opacity-100")}
                  style={{ backgroundColor: color }}>
                  {styleSettings.bgColor === color && <Check className="w-3.5 h-3.5" style={{ color: color === "#000000" || color === "#333333" || color === "#666666" ? "#fff" : "#000" }} strokeWidth={3} />}
                </button>
              ))}
              <label className="relative w-8 h-8 rounded-full flex-shrink-0 cursor-pointer flex items-center justify-center border-[1.5px] border-white/20 overflow-hidden" style={{ backgroundColor: styleSettings.bgColor || "#000000" }}>
                <input type="color" value={styleSettings.bgColor || "#000000"} onChange={(e) => updateStyle("bgColor", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-2.5"><span className="text-[10px] font-semibold tracking-widest text-white/30 uppercase">Opacity</span><span className="text-xs font-medium text-white/50 tabular-nums">{styleSettings.bgOpacity}%</span></div>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2"><div className="w-full h-[3px] rounded-full bg-white/[0.08]" /></div>
              <input type="range" min={0} max={100} step={1} value={styleSettings.bgOpacity} onChange={(e) => updateStyle("bgOpacity", Number(e.target.value))} className="relative w-full h-5 appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-runnable-track]:h-0 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-track]:h-0" />
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-2.5"><span className="text-[10px] font-semibold tracking-widest text-white/30 uppercase">Subtitle Delay</span><span className="text-xs font-medium text-white/50 tabular-nums">{(styleSettings.subtitleDelay ?? 0) >= 0 ? "+" : ""}{(styleSettings.subtitleDelay ?? 0).toFixed(1)}s</span></div>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2"><div className="w-full h-[3px] rounded-full bg-white/[0.08]" /></div>
              <input type="range" min={-5} max={5} step={0.1} value={styleSettings.subtitleDelay ?? 0} onChange={(e) => updateStyle("subtitleDelay", parseFloat(e.target.value))} className="relative w-full h-5 appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.5)] [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0" />
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">Negative = earlier, positive = later</p>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Font</span>
            <select value={styleSettings.fontFamily} onChange={(e) => updateStyle("fontFamily", e.target.value)} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
              {SUBTITLE_FONTS.map((f) => <option key={f.value} value={f.value} className="bg-[#111] text-white">{f.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Weight</span>
              <select value={styleSettings.fontWeight} onChange={(e) => updateStyle("fontWeight", e.target.value)} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
                {SUBTITLE_WEIGHTS.map((w) => <option key={w.value} value={w.value} className="bg-[#111] text-white">{w.label}</option>)}
              </select>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Style</span>
              <select value={styleSettings.fontStyle} onChange={(e) => updateStyle("fontStyle", e.target.value)} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
                {SUBTITLE_STYLES.map((s) => <option key={s.value} value={s.value} className="bg-[#111] text-white">{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Decoration</span>
            <select value={styleSettings.textDecoration} onChange={(e) => updateStyle("textDecoration", e.target.value)} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
              {SUBTITLE_DECORATIONS.map((d) => <option key={d.value} value={d.value} className="bg-[#111] text-white">{d.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Background</div><div className="text-[10px] text-white/30 mt-1">Box behind text</div></div><Toggle on={styleSettings.subtitleBgEnabled} onToggle={() => updateStyle("subtitleBgEnabled", !styleSettings.subtitleBgEnabled)} /></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Auto-detect</div><div className="text-[10px] text-white/30 mt-1">By audio track</div></div><Toggle on={styleSettings.subtitleAutoDetect} onToggle={() => updateStyle("subtitleAutoDetect", !styleSettings.subtitleAutoDetect)} /></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Fix subtitles</div><div className="text-[10px] text-white/30 mt-1">Clean up formatting</div></div><Toggle on={styleSettings.fixSubtitles} onToggle={() => updateStyle("fixSubtitles", !styleSettings.fixSubtitles)} /></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Fix capitalization</div><div className="text-[10px] text-white/30 mt-1">Sentence case</div></div><Toggle on={styleSettings.fixCapitalization} onToggle={() => updateStyle("fixCapitalization", !styleSettings.fixCapitalization)} /></div>
          </div>
        </div>
      </>
    );
  };

  const renderListOption = (
    label: string,
    selected: boolean,
    onClick: () => void,
    disabled?: boolean
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between py-2.5 px-2 rounded-lg transition-all duration-150 text-left ${
        !disabled ? "hover:bg-white/5" : "opacity-50 cursor-not-allowed"
      }`}
    >
      <span className={`text-sm font-medium ${selected ? "text-white" : "text-white/60"}`}>
        {label}
      </span>
      {selected && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--player-accent)] flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
      )}
    </button>
  );

  const renderListView = () => (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-3 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            aria-label="Back"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-white text-sm font-semibold">Subtitles</h2>
        </div>
        {onSettingsChange && (
          <button
            onClick={() => setView("style")}
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Customize
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3">
        <div className="flex flex-col gap-0">
          {renderListOption("Off", !currentSubtitle, () => {
            onSubtitleChange(null);
            onClose();
          })}
          {renderListOption(
            "Auto select",
            isAutoSelect,
            () => {
              if (defaultOrFirstTrack) {
                onSubtitleChange(defaultOrFirstTrack);
                onClose();
              }
            },
            subtitleTracks.length === 0
          )}
          {renderListOption(
            "Drop or upload file",
            false,
            () => fileInputRef.current?.click()
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.ass,.ssa"
            className="hidden"
            onChange={() => {}}
          />
          {renderListOption("Paste subtitle data", false, () => {})}
        </div>

        {tracksByLanguage.length > 0 && (
          <>
            <div className="h-px bg-white/10 my-2" />
            <div className="flex flex-col gap-0">
              {tracksByLanguage.map(({ key, displayName, tracks, flagUrl }) => {
                const hasSelected = tracks.some((t) => t.id === currentSubtitle?.id);
                const hasHearingImpaired = tracks.some((t) => t.isHearingImpaired);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (tracks.length === 1) {
                        onSubtitleChange(tracks[0]);
                        onClose();
                      } else {
                        setSelectedLanguageGroup(key);
                        setView("language");
                      }
                    }}
                    className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg transition-all duration-150 text-left hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {flagUrl ? (
                        <div className="flex-shrink-0 w-6 h-4 rounded overflow-hidden border border-white/20 bg-white/5">
                          <img
                            src={flagUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-6 h-4 rounded bg-white/10 border border-white/20" />
                      )}
                      <span className={`text-sm font-medium truncate ${hasSelected ? "text-white" : "text-white/60"}`}>
                        {displayName}
                      </span>
                      {hasHearingImpaired && (
                        <span title="Hearing impaired"><Ear className="w-3.5 h-3.5 text-white/50 flex-shrink-0" /></span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-sm text-white/50">{tracks.length}</span>
                      <ChevronRight className="w-4 h-4 text-white/50" />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {subtitleTracks.length === 0 && (
          <p className="text-xs text-white/40 mt-1.5 px-1">
            No subtitle tracks available yet.
          </p>
        )}
      </div>
    </>
  );

  const renderLanguageView = () => {
    const group = tracksByLanguage.find((g) => g.key === selectedLanguageGroup);
    if (!group) return null;
    return (
      <>
        <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-3 pb-2 border-b border-white/10">
          <button
            onClick={() => {
              setView("list");
              setSelectedLanguageGroup(null);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-white text-sm font-semibold">{group.displayName}</h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-1.5">
          <div className="flex flex-col gap-0">
            {group.tracks.map((track) => {
              const selected = currentSubtitle?.id === track.id;
              const displayName =
                track.display || track.label || track.language || "Track";
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => {
                    onSubtitleChange(track);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg transition-all duration-150 text-left hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-medium ${selected ? "text-white" : "text-white/60"}`}>
                      {displayName}
                    </span>
                    {track.isHearingImpaired && (
                      <span title="Hearing impaired"><Ear className="w-3.5 h-3.5 text-white/50 flex-shrink-0" /></span>
                    )}
                  </div>
                  {selected && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--player-accent)] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  if (inline) {
    return (
      <div className="flex flex-col h-full">
        {view === "style" && renderStyleView()}
        {view === "list" && renderListView()}
        {view === "language" && renderLanguageView()}
      </div>
    );
  }

  const useAnchorPosition = !!popupPosition;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-transparent"
        onClick={onClose}
        role="button"
        tabIndex={-1}
      />
      <div
        className={`fixed z-[55] pointer-events-none ${useAnchorPosition ? "" : "inset-0 flex items-center justify-center"}`}
      >
        <div
          ref={menuRef}
          className="bg-black/40 backdrop-blur-2xl rounded-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-[calc(100vw-24px)] pointer-events-auto overflow-hidden flex flex-col"
          style={
            useAnchorPosition
              ? {
                  position: "fixed",
                  top: popupPosition!.top,
                  left: popupPosition!.left,
                  width: popupPosition!.width,
                  height: popupPosition!.height,
                }
              : { margin: "0 16px", width: 320, maxHeight: "calc(100vh - 24px)" }
          }
          onClick={(e) => e.stopPropagation()}
        >
          {view === "style" ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {renderStyleView()}
            </div>
          ) : view === "language" ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {renderLanguageView()}
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {renderListView()}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SubtitleSelection;
