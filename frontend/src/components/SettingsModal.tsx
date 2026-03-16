import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { themes, categoryLabels, type Theme, type ThemeCategory } from "@/lib/themes";
import {
  User,
  Settings,
  Palette,
  Subtitles,
  BarChart3,
  Info,
  Search,
  Check,
  X,
  ChevronDown,
  Globe,
  Sparkles,
  LogIn,
  Eye,
  EyeOff,
  SlidersHorizontal,
  GripVertical,
  Puzzle,
  Monitor,
  Shield,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Download,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { getSettings, saveSettings, getContinueWatchingItems, getPreferredLanguage, savePreferredLanguage } from "@/components/player/lib/storage";
import { getServerOrder, saveServerOrder, type ServerOrder } from "@/components/player/lib/serverStorage";
import { baseServerConfigs } from "@/components/player/servers/index";
import { isExtensionActive } from "@/backend/extension";
import { isElectronApp, getElectronAPI } from "@/lib/electron";
import { config } from "@/lib/config";
import { fetchPlayerSettings, savePlayerSettingsToBackend, fetchAllProgress, fetchSessions, revokeSession, revokeAllOtherSessions, apiUrl } from "@/lib/api/backend";
import type { BackendProgress, BackendSession } from "@/lib/api/backend";
import { version } from "../../package.json";
import { VerticalScrollArea } from "@/components/media/VerticalScrollArea";

type SettingsTab = "user" | "account" | "appearance" | "preferences" | "subtitles" | "stats" | "about" | "app";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const baseSidebarItems = [
  { id: "user" as SettingsTab, label: "User", icon: User },
  { id: "account" as SettingsTab, label: "Account", icon: Settings },
  { id: "appearance" as SettingsTab, label: "Appearance", icon: Palette },
  { id: "preferences" as SettingsTab, label: "Preferences", icon: SlidersHorizontal },
  { id: "subtitles" as SettingsTab, label: "Subtitles", icon: Subtitles },
  { id: "stats" as SettingsTab, label: "Stats", icon: BarChart3 },
  { id: "about" as SettingsTab, label: "About", icon: Info },
];

const appSidebarItem = { id: "app" as SettingsTab, label: "App", icon: Monitor };

const UpdateCard: React.FC = () => {
  const electron = getElectronAPI();
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!electron?.updaterOn || !isElectronApp()) return;
    const unsub1 = electron.updaterOn("updater:update-available", (info: { version?: string }) => {
      setUpdateAvailable(info ? { version: info.version || "New" } : { version: "New" });
      setError(null);
      setCheckMessage(null);
    });
    const unsub2 = electron.updaterOn("updater:update-not-available", () => {
      setUpdateAvailable(null);
      setCheckMessage("You're on the latest version");
      setError(null);
    });
    const unsub3 = electron.updaterOn("updater:download-progress", (p: { percent?: number }) => {
      setDownloadProgress(p?.percent ?? null);
    });
    const unsub4 = electron.updaterOn("updater:update-downloaded", () => {
      setUpdateDownloaded(true);
      setDownloading(false);
      setDownloadProgress(null);
    });
    const unsub5 = electron.updaterOn("updater:error", (e: { message?: string }) => {
      setError(e?.message ?? "Update failed");
      setChecking(false);
      setDownloading(false);
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [electron]);

  const handleCheck = async () => {
    if (!electron?.updaterCheck) return;
    setChecking(true);
    setError(null);
    setCheckMessage(null);
    setUpdateAvailable(null);
    try {
      const r = await electron.updaterCheck();
      if (!r.success && !r.error?.includes("not available")) setError(r.error ?? "Check failed");
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    if (!electron?.updaterDownload) return;
    setDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      const r = await electron.updaterDownload();
      if (!r.success) setError(r.error ?? "Download failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  };

  const handleRestart = () => {
    electron?.updaterQuitAndInstall?.();
  };

  if (!isElectronApp() || !electron?.updaterCheck) return null;

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">Updates</div>
          <div className="text-xs text-white/40 mt-0.5">Check for and install app updates</div>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      {checkMessage && !updateAvailable && <p className="text-xs text-green-400 mb-3">{checkMessage}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!updateAvailable && !updateDownloaded && (
          <button
            onClick={handleCheck}
            disabled={checking}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm text-white hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check for updates
          </button>
        )}
        {updateAvailable && !updateDownloaded && !downloading && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-sm text-blue-300 hover:bg-blue-500/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download v{updateAvailable.version}
          </button>
        )}
        {downloading && (
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${downloadProgress ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-white/50">{Math.round(downloadProgress ?? 0)}%</span>
          </div>
        )}
        {updateDownloaded && (
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-sm text-green-300 hover:bg-green-500/30 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restart to install
          </button>
        )}
      </div>
    </div>
  );
};

const WarpSettingsCard: React.FC = () => {
  const electron = getElectronAPI();
  const [warpEnabled, setWarpEnabled] = useState<boolean | null>(null);
  const [warpLoading, setWarpLoading] = useState(false);
  const [warpError, setWarpError] = useState<string | null>(null);
  const [showWarpWarning, setShowWarpWarning] = useState(false);

  useEffect(() => {
    if (electron?.warpStatus) {
      electron.warpStatus().then((status) => setWarpEnabled(status.enabled)).catch(() => setWarpEnabled(false));
    }
  }, [electron]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowWarpWarning(false);
    };
    if (showWarpWarning) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [showWarpWarning]);

  const doEnableWarp = async () => {
    if (!electron?.warpEnable) return;
    setWarpLoading(true);
    setWarpError(null);
    try {
      const result = await electron.warpEnable();
      if (result.success) {
        setWarpEnabled(true);
      } else {
        setWarpError(result.error ?? "Failed to enable WARP");
      }
    } catch (e) {
      setWarpError(e instanceof Error ? e.message : "Failed");
    } finally {
      setWarpLoading(false);
    }
  };

  const handleWarpToggle = async () => {
    if (!electron?.warpEnable || !electron?.warpDisable) return;
    if (warpEnabled) {
      setWarpLoading(true);
      setWarpError(null);
      try {
        await electron.warpDisable();
        setWarpEnabled(false);
      } catch (e) {
        setWarpError(e instanceof Error ? e.message : "Failed");
      } finally {
        setWarpLoading(false);
      }
    } else {
      setShowWarpWarning(true);
    }
  };

  if (!electron?.warpEnable) return null;

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">Cloudflare WARP</div>
          <div className="text-xs text-white/40 mt-0.5">Route app traffic through Cloudflare WARP proxy (may help with geo-restricted or blocked sources)</div>
          {warpError && <p className="text-xs text-red-400 mt-1.5">{warpError}</p>}
        </div>
        <button
          onClick={handleWarpToggle}
          disabled={warpLoading || warpEnabled === null}
          className={cn(
            "relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none disabled:opacity-50",
            warpEnabled ? "bg-amber-500" : "bg-white/15"
          )}
        >
          {warpLoading ? (
            <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white animate-spin" />
          ) : (
            <div
              className={cn(
                "absolute top-[3px] w-3.5 h-3.5 rounded-full shadow-sm transition-all duration-200",
                warpEnabled ? "left-[18px] bg-white" : "left-[3px] bg-white/60"
              )}
            />
          )}
        </button>
      </div>
      {warpEnabled && !warpLoading && (
        <p className="text-[10px] text-white/30 mt-2.5">Proxy: socks5://127.0.0.1:40000</p>
      )}
      {showWarpWarning &&
        createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowWarpWarning(false)} />
            <div
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">Before enabling Cloudflare WARP</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Windows Defender may flag the downloaded tools as a threat. This is a <strong className="text-white">false positive</strong>.
                  </p>
                  <p className="mt-3 text-sm text-white/70">
                    WARP uses two open-source tools downloaded from GitHub:
                  </p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-white/60">
                    <li>
                      <strong className="text-white/80">wgcf</strong> — generates WireGuard config from Cloudflare WARP
                    </li>
                    <li>
                      <strong className="text-white/80">wireproxy</strong> — creates a local SOCKS5 proxy from that config
                    </li>
                  </ul>
                  <p className="mt-3 text-sm text-white/70">
                    <strong className="text-white">To avoid the warning</strong>, add an exclusion in Windows Security before enabling:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-white/60">
                    <li>Open Windows Security → Virus & threat protection</li>
                    <li>Manage settings → Add or remove exclusions</li>
                    <li>Add folder: <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">%AppData%\uira-live-app\warp</code></li>
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="https://github.com/ViRb3/wgcf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                    >
                      wgcf on GitHub <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href="https://github.com/pufferffish/wireproxy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                    >
                      wireproxy on GitHub <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 border-t border-white/[0.06] p-4">
                <button
                  onClick={() => setShowWarpWarning(false)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowWarpWarning(false);
                    doEnableWarp();
                  }}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-amber-400"
                >
                  I understand, enable WARP
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const ChangePasswordModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false); onClose();
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setError(""); setSuccess(false); setIsLoading(false);
    }, 150);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!currentPassword || !newPassword || !confirmPassword) { setError("All fields are required"); return; }
    if (newPassword.length < 6) { setError("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json();
      if (response.ok) { setSuccess(true); setTimeout(() => handleClose(), 1500); }
      else setError(data.error || 'Failed to change password');
    } catch { setError('Network error. Please try again.'); }
    finally { setIsLoading(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-[10000] flex items-center justify-center p-4", isClosing && "opacity-0 transition-opacity duration-150")}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className={cn("relative w-full max-w-md overflow-hidden", "bg-[#0c0c0c] border border-white/[0.08] rounded-xl", "shadow-[0_24px_48px_rgba(0,0,0,0.6)]", "animate-in fade-in zoom-in-95 duration-200", isClosing && "animate-out fade-out zoom-out-95 duration-150")}>
        <button onClick={handleClose} className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all">
          <X className="w-4 h-4" />
        </button>
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Change Password</h3>
            <p className="text-sm text-white/40 mt-1">Update your account password</p>
          </div>
          {success ? (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-400 text-center">Password changed successfully!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><p className="text-sm text-red-400">{error}</p></div>}
              {[
                { label: "Current Password", value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword), placeholder: "Enter current password" },
                { label: "New Password", value: newPassword, setter: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword), placeholder: "Enter new password" },
                { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword), placeholder: "Confirm new password" },
              ].map(({ label, value, setter, show, toggle, placeholder }) => (
                <div key={label}>
                  <label className="block text-sm text-white/50 mb-1.5">{label}</label>
                  <div className="relative">
                    <input type={show ? "text" : "password"} value={value} onChange={(e) => setter(e.target.value)} className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors pr-10" placeholder={placeholder} />
                    <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} disabled={isLoading} className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50">{isLoading ? 'Changing...' : 'Change Password'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

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

const SUBTITLE_BG_COLORS = [
  { color: "#000000", label: "Black" }, { color: "#333333", label: "Dark Gray" },
  { color: "#666666", label: "Gray" }, { color: "#FFFFFF", label: "White" },
];

const pxToSizeLabel = (px: number): string => {
  const closest = SUBTITLE_SIZES.reduce((prev, curr) => Math.abs(curr.px - px) < Math.abs(prev.px - px) ? curr : prev);
  return closest.label;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = "appearance" }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user, token, updateUser } = useAuth();
  const { selectedTheme, setSelectedTheme, currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [activeCategory, setActiveCategory] = useState<ThemeCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [displayName, setDisplayName] = useState(user?.username || user?.email?.split('@')[0] || "User");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [subtitleSizeLabel, setSubtitleSizeLabel] = useState("L");
  const [subtitleColor, setSubtitleColor] = useState("#FFFFFF");
  const [fixSubtitles, setFixSubtitles] = useState(true);
  const [fixCapitalization, setFixCapitalization] = useState(false);
  const [subtitleBgEnabled, setSubtitleBgEnabled] = useState(true);
  const [subtitleAutoDetect, setSubtitleAutoDetect] = useState(true);
  const [subtitleOpacity, setSubtitleOpacity] = useState(100);
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [subtitleFontFamily, setSubtitleFontFamily] = useState("Default");
  const [subtitleFontWeight, setSubtitleFontWeight] = useState("normal");
  const [subtitleFontStyle, setSubtitleFontStyle] = useState("normal");
  const [subtitleTextDecoration, setSubtitleTextDecoration] = useState("none");
  const [subtitleBackground, setSubtitleBackground] = useState("#000000");
  const [backendProgressItems, setBackendProgressItems] = useState<BackendProgress[]>([]);
  const [genreData, setGenreData] = useState<{ name: string; pct: number }[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [prefLanguage, setPrefLanguage] = useState(getPreferredLanguage());
  const [prefAutoplay, setPrefAutoplay] = useState(true);
  const [prefSkipEndCredits, setPrefSkipEndCredits] = useState(true);
  const [prefServerOrder, setPrefServerOrder] = useState<ServerOrder[]>([]);
  const [extensionActive, setExtensionActive] = useState<boolean | null>(null);
  const [draggedServerId, setDraggedServerId] = useState<string | null>(null);
  const persistSubtitleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      setDisplayName(user?.username || user?.email?.split('@')[0] || "User");
      setAvatarPreview(user?.avatar || null);
      setSaveMessage("");
      const saved = getSettings();
      const applySubSettings = (s: Record<string, any>) => {
        if (s.subtitleSize) setSubtitleSizeLabel(pxToSizeLabel(s.subtitleSize as number));
        if (s.subtitleColor) setSubtitleColor(s.subtitleColor as string);
        if ((s as any).fixSubtitles !== undefined) setFixSubtitles((s as any).fixSubtitles as boolean);
        if ((s as any).fixCapitalization !== undefined) setFixCapitalization((s as any).fixCapitalization as boolean);
        if (s.subtitleBgEnabled !== undefined) setSubtitleBgEnabled(s.subtitleBgEnabled as boolean);
        if (s.subtitleAutoDetect !== undefined) setSubtitleAutoDetect(s.subtitleAutoDetect as boolean);
        if (s.subtitleOpacity !== undefined) setSubtitleOpacity(s.subtitleOpacity as number);
        if (s.subtitleDelay != null && !Number.isNaN(Number(s.subtitleDelay))) setSubtitleDelay(Number(s.subtitleDelay));
        if (s.subtitleFontFamily) setSubtitleFontFamily(s.subtitleFontFamily as string);
        if (s.subtitleFontWeight) setSubtitleFontWeight(s.subtitleFontWeight as string);
        if (s.subtitleFontStyle) setSubtitleFontStyle(s.subtitleFontStyle as string);
        if (s.subtitleTextDecoration) setSubtitleTextDecoration(s.subtitleTextDecoration as string);
        if (s.subtitleBackground) setSubtitleBackground(s.subtitleBackground as string);
      };
      applySubSettings(saved);
      setPrefLanguage(getPreferredLanguage());
      setPrefAutoplay((saved as any).autoNext !== false);
      setPrefSkipEndCredits((saved as any).skipEndCredits !== false);
      const order = getServerOrder();
      if (order && order.length > 0) {
        setPrefServerOrder(order);
      } else {
        const defaultOrder: ServerOrder[] = baseServerConfigs
          .filter(s => s.enabled && !s.disabled)
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({ id: s.id, order: i, enabled: true }));
        setPrefServerOrder(defaultOrder);
      }
      isExtensionActive().then(setExtensionActive);
      fetchPlayerSettings().then(backend => {
        if (backend && Object.keys(backend).length > 0) {
          const merged = { ...saved, ...backend };
          saveSettings(merged);
          applySubSettings(merged);
        }
      });
      fetchAllProgress().then(items => { if (items.length > 0) setBackendProgressItems(items); });
      if (isAuthenticated) {
        setSessionsLoading(true);
        fetchSessions().then(s => { setSessions(s); setSessionsLoading(false); });
      }
    }
    return () => { document.removeEventListener("keydown", handleEscape); document.body.style.overflow = ""; };
  }, [isOpen, user]);

  useEffect(() => {
    const localItems = getContinueWatchingItems();
    const allItems: { tmdbId: number; type: 'movie' | 'tv' }[] = [
      ...backendProgressItems.map(b => ({ tmdbId: b.tmdbId, type: (b.type === 'MOVIE' ? 'movie' : 'tv') as 'movie' | 'tv' })),
    ];
    localItems.forEach(l => { if (!allItems.some(a => a.tmdbId === l.tmdbId && a.type === l.type)) allItems.push({ tmdbId: l.tmdbId, type: l.type }); });
    if (allItems.length === 0) { setGenreData([]); return; }
    if (!config.tmdb.apiKey) return;
    const unique = allItems.filter((item, idx, arr) => arr.findIndex(a => a.tmdbId === item.tmdbId && a.type === item.type) === idx);
    setGenresLoading(true);
    Promise.all(
      unique.map(({ tmdbId, type }) =>
        fetch(`${config.tmdb.baseUrl}/${type}/${tmdbId}?api_key=${config.tmdb.apiKey}&language=en-US`)
          .then(r => r.ok ? r.json() : null)
          .then((d: any) => d ? (d.genres as { id: number; name: string }[] || []).map(g => g.name) : [])
          .catch(() => [] as string[])
      )
    ).then(results => {
      const counts: Record<string, number> = {};
      results.flat().forEach(name => { counts[name] = (counts[name] || 0) + 1; });
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, pct: Math.round((count / total) * 100) }));
      setGenreData(sorted);
      setGenresLoading(false);
    });
  }, [backendProgressItems]);

  const persistSubtitleSettings = (overrides: Record<string, unknown> = {}) => {
    const sizePx = SUBTITLE_SIZES.find(s => s.label === subtitleSizeLabel)?.px ?? 32;
    const settings: Record<string, unknown> = {
      subtitleSize: sizePx, subtitleColor, subtitleBgEnabled,
      subtitleAutoDetect, subtitleOpacity,
      subtitleBgOpacity: subtitleBgEnabled ? (subtitleOpacity / 100) * 0.75 : 0,
      subtitleDelay, subtitleFontFamily, subtitleFontWeight, subtitleFontStyle,
      subtitleTextDecoration, subtitleBackground, fixSubtitles, fixCapitalization,
      ...overrides,
    };
    const existing = getSettings();
    saveSettings({ ...existing, ...settings });
    const payload = {
      subtitleSize: settings.subtitleSize as number, subtitleColor: settings.subtitleColor as string,
      subtitleBgEnabled: settings.subtitleBgEnabled as boolean,
      subtitleAutoDetect: settings.subtitleAutoDetect as boolean, subtitleOpacity: settings.subtitleOpacity as number,
      subtitleBgOpacity: settings.subtitleBgOpacity as number,
      subtitleDelay: settings.subtitleDelay as number, subtitleFontFamily: settings.subtitleFontFamily as string,
      subtitleFontWeight: settings.subtitleFontWeight as string, subtitleFontStyle: settings.subtitleFontStyle as string,
      subtitleTextDecoration: settings.subtitleTextDecoration as string,
      subtitleBackground: settings.subtitleBackground as string,
      fixSubtitles: settings.fixSubtitles as boolean,
      fixCapitalization: settings.fixCapitalization as boolean,
    };
    if (persistSubtitleDebounceRef.current) clearTimeout(persistSubtitleDebounceRef.current);
    persistSubtitleDebounceRef.current = setTimeout(() => {
      savePlayerSettingsToBackend(payload);
      persistSubtitleDebounceRef.current = null;
    }, 400);
  };

  const handleClose = () => { setIsClosing(true); setTimeout(() => { setIsClosing(false); onClose(); }, 150); };
  const handleResetDefaults = () => { setSelectedTheme("really-dark"); setActiveCategory("all"); setSearchQuery(""); };

  const filteredThemes = themes.filter((theme) => {
    const matchesCategory = activeCategory === "all" || theme.category.includes(activeCategory);
    const matchesSearch = theme.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderThemeCard = (theme: Theme) => {
    const isSelected = selectedTheme === theme.id;
    const accent = currentTheme.accentColor;
    return (
      <button key={theme.id} onClick={() => setSelectedTheme(theme.id)}
        className={cn("group relative rounded-xl overflow-hidden transition-all duration-150 border", isSelected ? "border-transparent" : "border-white/5 hover:border-[var(--modal-accent)]/40")}
        style={isSelected ? { borderColor: accent, boxShadow: `0 0 16px ${accent}30` } : undefined}>
        <div className="aspect-[16/10] relative p-3 flex gap-2" style={{ backgroundColor: theme.contentColor }}>
          <div className="w-[20%] rounded-lg" style={{ backgroundColor: theme.sidebarColor }} />
          <div className="flex-1 flex flex-col gap-1.5 pt-1">
            <div className="h-2 w-3/5 rounded-full" style={{ backgroundColor: theme.accentColor }} />
            <div className="h-1.5 w-full rounded-full opacity-30" style={{ backgroundColor: theme.sidebarColor }} />
            <div className="h-1.5 w-4/5 rounded-full opacity-30" style={{ backgroundColor: theme.sidebarColor }} />
          </div>
          {theme.isNew && (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-white text-black text-[10px] font-semibold rounded-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />NEW
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: accent }}>
                <Check className="w-4 h-4" style={{ color: theme.contentColor }} />
              </div>
            </div>
          )}
        </div>
        <div className="px-3 py-2 bg-[#111] border-t border-white/5">
          <span className="text-sm font-medium" style={{ color: isSelected ? accent : "rgba(255,255,255,0.8)" }}>{theme.name}</span>
        </div>
      </button>
    );
  };

  const LANGUAGES = [
    { value: "en-US", label: "English" },
    { value: "es-ES", label: "Español" },
    { value: "fr-FR", label: "Français" },
    { value: "de-DE", label: "Deutsch" },
    { value: "pt-BR", label: "Português (Brasil)" },
    { value: "ja-JP", label: "日本語" },
    { value: "ko-KR", label: "한국어" },
    { value: "zh-CN", label: "中文" },
  ];

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} aria-pressed={on} className={cn("relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none", on ? "bg-white" : "bg-white/15")}>
      <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/40 transition-transform duration-200", on ? "translate-x-4" : "translate-x-0")} />
    </button>
  );

  const handlePrefLanguageChange = (lang: string) => {
    setPrefLanguage(lang);
    savePreferredLanguage(lang);
    window.dispatchEvent(new Event("storage")); // notify TMDB etc.
  };

  const handlePrefAutoplayToggle = () => {
    const next = !prefAutoplay;
    setPrefAutoplay(next);
    const existing = getSettings();
    saveSettings({ ...existing, autoNext: next });
  };

  const handlePrefSkipEndCreditsToggle = () => {
    const next = !prefSkipEndCredits;
    setPrefSkipEndCredits(next);
    const existing = getSettings();
    saveSettings({ ...existing, skipEndCredits: next });
  };

  const handleServerReorder = (orderedIds: string[], fromIndex: number, toIndex: number) => {
    const next = [...orderedIds];
    const [removedId] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removedId);
    const withOrder: ServerOrder[] = next.map((id, i) => ({
      id,
      order: i,
      enabled: prefServerOrder.find(so => so.id === id)?.enabled ?? true,
    }));
    setPrefServerOrder(withOrder);
    saveServerOrder(withOrder);
  };

  const handleServerDragStart = (e: React.DragEvent, id: string) => {
    setDraggedServerId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleServerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleServerDrop = (e: React.DragEvent, orderedIds: string[], toIndex: number) => {
    e.preventDefault();
    setDraggedServerId(null);
    const id = e.dataTransfer.getData("text/plain");
    const fromIndex = orderedIds.indexOf(id);
    if (fromIndex >= 0 && fromIndex !== toIndex) {
      handleServerReorder(orderedIds, fromIndex, toIndex);
    }
  };

  const handleServerDragEnd = () => setDraggedServerId(null);

  const renderPreferencesContent = () => {
    const enabledServers = baseServerConfigs.filter(s => s.enabled && !s.disabled);
    const serverMap = new Map(enabledServers.map(s => [s.id, s]));
    const orderedServers = prefServerOrder.length > 0
      ? prefServerOrder
          .map(so => serverMap.get(so.id))
          .filter((s): s is NonNullable<typeof s> => !!s)
      : enabledServers.sort((a, b) => a.order - b.order);

    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0"><h2 className="text-xl font-semibold text-white">Preferences</h2><p className="text-sm text-white/40 mt-1">Language, playback, and source order</p></div>

        <div className="flex-1 min-h-0 space-y-4 pt-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <label className="block text-sm font-medium text-white mb-2">Language</label>
            <p className="text-xs text-white/40 mb-3">Content metadata (titles, descriptions) will be shown in this language.</p>
            <select
              value={prefLanguage}
              onChange={(e) => handlePrefLanguageChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
            >
              {LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value} className="bg-[#111] text-white">{label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-white">Autoplay</div>
              <div className="text-xs text-white/40 mt-0.5">Automatically play the next episode in a series after reaching the end.</div>
            </div>
            <Toggle on={prefAutoplay} onToggle={handlePrefAutoplayToggle} />
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-white">Skip end credits</div>
              <div className="text-xs text-white/40 mt-0.5">When enabled, automatically play the next episode at 99% completion to skip end credits. When disabled, wait until the episode is fully completed.</div>
            </div>
            <Toggle on={prefSkipEndCredits} onToggle={handlePrefSkipEndCreditsToggle} />
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="text-sm font-medium text-white mb-2">Reordering sources</div>
            <p className="text-xs text-white/40 mb-3">Drag and drop to reorder sources. This determines the order in which sources are checked for the media you are trying to watch. If a source is greyed out, it means the extension is required for that source.</p>
            <p className="text-xs text-white/30 mb-4">The default order is best for most users.</p>
            <div className="space-y-2">
              {orderedServers.map((server, index) => {
                const needsExtension = server.extensionRequired && extensionActive === false;
                const orderedIds = orderedServers.map(s => s.id);
                return (
                  <div
                    key={server.id}
                    draggable
                    onDragStart={(e) => handleServerDragStart(e, server.id)}
                    onDragOver={handleServerDragOver}
                    onDrop={(e) => handleServerDrop(e, orderedIds, index)}
                    onDragEnd={handleServerDragEnd}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing",
                      needsExtension ? "bg-white/[0.02] border-white/5 text-white/40" : "bg-white/[0.04] border-white/10 text-white/90",
                      draggedServerId === server.id && "opacity-50"
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-white/30 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">{server.name}</span>
                    {needsExtension && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400/80" title="Extension required">
                        <Puzzle className="w-3.5 h-3.5" />
                        Extension
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppearanceContent = () => (
      <div className="space-y-5 h-full flex flex-col">
        {/* Mobile: Language selector at top (like screenshot) */}
        <div className="sm:hidden flex-shrink-0">
          <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
            <Globe className="w-4 h-4 text-white/50" />
            Language
          </label>
          <select
            value={prefLanguage}
            onChange={(e) => handlePrefLanguageChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20 flex items-center justify-between"
          >
            {LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value} className="bg-[#111] text-white">{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-white">Appearance</h2>
            <p className="text-sm text-white/40 mt-1">Customize how the app looks</p>
          </div>
          <button onClick={handleResetDefaults} className="text-xs text-white/40 hover:text-[var(--modal-accent)] transition-colors underline-offset-2 hover:underline">Reset Defaults</button>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden sm:overflow-visible">
          {(Object.keys(categoryLabels) as ThemeCategory[]).map((category) => {
            const isActive = activeCategory === category;
            return (
              <button key={category} onClick={() => setActiveCategory(category)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0", !isActive && "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70")}
                style={isActive ? { backgroundColor: currentTheme.accentColor, color: currentTheme.contentColor } : undefined}>
                {categoryLabels[category]}
              </button>
            );
          })}
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search themes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--modal-accent)]/50 transition-colors" />
        </div>
        <div className="flex-1 min-h-0">
          <VerticalScrollArea className="h-full -mx-1 px-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{filteredThemes.map(renderThemeCard)}</div>
          </VerticalScrollArea>
        </div>
      </div>
  );

  const renderUserContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4"><LogIn className="w-8 h-8 text-white/40" /></div>
          <h2 className="text-xl font-semibold text-white mb-2">Not Logged In</h2>
          <p className="text-sm text-white/40 mb-6 max-w-xs">Sign in to access your profile settings and personalize your experience</p>
          <button onClick={() => { onClose(); navigate("/login"); }} className="px-6 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">Sign In</button>
        </div>
      );
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !token) return;
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) { setSaveMessage("Please select a valid image file (JPEG, PNG, GIF, or WebP)."); return; }
      if (file.size > 5 * 1024 * 1024) { setSaveMessage("File size must be less than 5MB."); return; }
      setIsUploadingAvatar(true); setSaveMessage("");
      try {
        const formData = new FormData();
        formData.append('avatar', file);
        const response = await fetch(apiUrl('/api/uploads/avatar'), { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        const data = await response.json();
        if (response.ok) { setAvatarPreview(data.avatarUrl); updateUser(data.user); setSaveMessage("Avatar uploaded successfully!"); }
        else setSaveMessage(data.error || "Failed to upload avatar.");
      } catch { setSaveMessage("Network error. Please try again."); }
      finally { setIsUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const handleRemoveAvatar = async () => {
      if (!token) return;
      setIsUploadingAvatar(true); setSaveMessage("");
      try {
        const response = await fetch(apiUrl('/api/uploads/avatar'), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (response.ok) { setAvatarPreview(null); updateUser(data.user); setSaveMessage("Avatar removed successfully!"); }
        else setSaveMessage(data.error || "Failed to remove avatar.");
      } catch { setSaveMessage("Network error. Please try again."); }
      finally { setIsUploadingAvatar(false); }
    };

    const handleSaveProfile = async () => {
      if (!token) return;
      setIsSaving(true); setSaveMessage("");
      try {
        const response = await fetch(apiUrl('/api/auth/profile'), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ username: displayName }) });
        const data = await response.json();
        if (response.ok) { updateUser(data.user); setSaveMessage("Profile saved successfully!"); }
        else setSaveMessage(data.error || "Failed to save profile.");
      } catch { setSaveMessage("Network error. Please try again."); }
      finally { setIsSaving(false); }
    };

    return (
      <div className="space-y-6 h-full flex flex-col">
        <div><h2 className="text-xl font-semibold text-white">User</h2><p className="text-sm text-white/40 mt-1">Manage your profile</p></div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <>
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover"
                      onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; const f = t.parentElement?.querySelector('.avatar-fallback') as HTMLElement; if (f) f.style.display = 'flex'; }} />
                    <div className="avatar-fallback absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}><User className="w-8 h-8 text-white/40" /></div>
                  </>
                ) : <User className="w-8 h-8 text-white/40" />}
              </div>
              {isUploadingAvatar && <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar} className="px-4 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isUploadingAvatar ? 'Uploading...' : 'Change Avatar'}</button>
              {avatarPreview && <button onClick={handleRemoveAvatar} disabled={isUploadingAvatar} className="px-4 py-2 bg-red-500/[0.08] border border-red-500/20 rounded-lg text-sm text-red-400 hover:bg-red-500/[0.12] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Remove</button>}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <div className="space-y-4 flex-1">
          <div><label className="block text-sm text-white/50 mb-1.5">Display Name</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors" /></div>
          <div><label className="block text-sm text-white/50 mb-1.5">Email</label><input type="email" value={user?.email || ""} readOnly className="w-full px-4 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white/60 cursor-not-allowed" /></div>
          {saveMessage && <div className={`text-sm ${saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>{saveMessage}</div>}
          <button onClick={handleSaveProfile} disabled={isSaving} className="w-full px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Profile'}</button>
        </div>
      </div>
    );
  };

  const renderAccountContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4"><Settings className="w-8 h-8 text-white/40" /></div>
          <h2 className="text-xl font-semibold text-white mb-2">Account Settings</h2>
          <p className="text-sm text-white/40 mb-6 max-w-xs">Sign in to manage your account security settings</p>
          <button onClick={() => { onClose(); navigate("/login"); }} className="px-6 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">Sign In</button>
        </div>
      );
    }

    const handleRevokeSession = async (sessionId: string) => {
      setRevokingSession(sessionId);
      const ok = await revokeSession(sessionId);
      if (ok) setSessions(prev => prev.filter(s => s.id !== sessionId));
      setRevokingSession(null);
    };

    const handleRevokeAll = async () => {
      setRevokingSession('all');
      const ok = await revokeAllOtherSessions();
      if (ok) setSessions(prev => prev.filter(s => s.isCurrent));
      setRevokingSession(null);
    };

    const formatSessionDate = (iso: string) => {
      const d = new Date(iso); const now = new Date(); const diff = now.getTime() - d.getTime();
      if (diff < 60_000) return 'Just now';
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getDeviceIcon = (deviceName: string) => {
      if (/iOS|iPhone|iPad/i.test(deviceName)) return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2.5" strokeLinecap="round" /></svg>;
      if (/Android/i.test(deviceName)) return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="4" width="14" height="18" rx="2" /><line x1="9" y1="2" x2="9.01" y2="2" strokeWidth="2" strokeLinecap="round" /><line x1="15" y1="2" x2="15.01" y2="2" strokeWidth="2" strokeLinecap="round" /></svg>;
      return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
    };

    return (
      <div className="flex-1 flex flex-col gap-5 min-h-0">
        <div><h2 className="text-xl font-semibold text-white">Account</h2><p className="text-sm text-white/40 mt-1">Security & preferences</p></div>
        <div className="space-y-2">
          <button onClick={() => setShowChangePasswordModal(true)} className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white/80 hover:bg-white/[0.05] transition-colors group"><span>Change Password</span><ChevronDown className="w-4 h-4 text-white/30 -rotate-90 group-hover:text-white/50" /></button>
          <button className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white/80 hover:bg-white/[0.05] transition-colors group"><span>Two-Factor Authentication</span><ChevronDown className="w-4 h-4 text-white/30 -rotate-90 group-hover:text-white/50" /></button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="text-sm font-semibold text-white">Active Logins</h3><p className="text-xs text-white/35 mt-0.5">Devices currently signed into your account</p></div>
            {sessions.filter(s => !s.isCurrent).length > 0 && (
              <button onClick={handleRevokeAll} disabled={revokingSession === 'all'} className="text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40">{revokingSession === 'all' ? 'Revoking…' : 'Sign out all others'}</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {sessionsLoading && [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex-shrink-0" />
                <div className="flex-1 space-y-1.5"><div className="h-3 bg-white/[0.06] rounded w-2/3" /><div className="h-2.5 bg-white/[0.04] rounded w-1/3" /></div>
              </div>
            ))}
            {!sessionsLoading && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-white/15 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                <p className="text-sm text-white/35">No session data yet</p>
                <p className="text-xs text-white/20 mt-1">Log out and back in to start tracking</p>
              </div>
            )}
            {!sessionsLoading && sessions.map(session => (
              <div key={session.id} className={cn("flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors", session.isCurrent ? "bg-white/[0.05] border-white/[0.12]" : "bg-white/[0.03] border-white/[0.06]")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", session.isCurrent ? "bg-white/[0.1] text-white" : "bg-white/[0.05] text-white/40")}>{getDeviceIcon(session.deviceName)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/90 truncate">{session.deviceName}</span>
                    {session.isCurrent && <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-white/60 flex-shrink-0">This device</span>}
                  </div>
                  <span className="text-[11px] text-white/30">{session.isCurrent ? `Active ${formatSessionDate(session.lastSeenAt)}` : `Last seen ${formatSessionDate(session.lastSeenAt)}`}</span>
                </div>
                {!session.isCurrent && (
                  <button onClick={() => handleRevokeSession(session.id)} disabled={revokingSession === session.id} className="flex-shrink-0 text-xs text-white/25 hover:text-red-400 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-400/[0.08]">{revokingSession === session.id ? '…' : 'Remove'}</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <button className="w-full px-4 py-3 bg-red-500/[0.08] border border-red-500/20 rounded-lg text-sm text-red-400 hover:bg-red-500/[0.12] transition-colors flex-shrink-0">Delete Account</button>
      </div>
    );
  };

  const renderSubtitlesContent = () => {
    const currentSizePx = SUBTITLE_SIZES.find(s => s.label === subtitleSizeLabel)?.px ?? 32;
    const handleSizeChange = (label: string) => { setSubtitleSizeLabel(label); const px = SUBTITLE_SIZES.find(s => s.label === label)?.px ?? 32; persistSubtitleSettings({ subtitleSize: px }); };
    const handleColorChange = (color: string) => { setSubtitleColor(color); persistSubtitleSettings({ subtitleColor: color }); };
    const handleBgToggle = () => { const next = !subtitleBgEnabled; setSubtitleBgEnabled(next); persistSubtitleSettings({ subtitleBgEnabled: next, subtitleBgOpacity: next ? (subtitleOpacity / 100) * 0.75 : 0 }); };
    const handleAutoDetectToggle = () => { const next = !subtitleAutoDetect; setSubtitleAutoDetect(next); persistSubtitleSettings({ subtitleAutoDetect: next }); };
    const handleOpacityChange = (val: number) => { setSubtitleOpacity(val); persistSubtitleSettings({ subtitleOpacity: val, subtitleBgOpacity: subtitleBgEnabled ? (val / 100) * 0.75 : 0 }); };

    const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
      <button onClick={onToggle} aria-pressed={on} className={cn("relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none", on ? "bg-white" : "bg-white/15")}>
        <div className={cn("absolute top-[3px] w-3.5 h-3.5 rounded-full shadow-sm transition-all duration-200", on ? "left-[18px] bg-black" : "left-[3px] bg-white/60")} />
      </button>
    );

    return (
      <div className="flex-1 flex flex-col gap-0 min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div><h2 className="text-lg font-semibold text-white tracking-tight">Subtitles</h2><p className="text-xs text-white/35 mt-0.5">Customize how subtitles appear</p></div>
          <button onClick={() => { setSubtitleSizeLabel("L"); setSubtitleColor("#FFFFFF"); setSubtitleBgEnabled(true); setSubtitleAutoDetect(true); setSubtitleOpacity(100); setSubtitleDelay(0); setSubtitleFontFamily("Default"); setSubtitleFontWeight("normal"); setSubtitleFontStyle("normal"); setSubtitleTextDecoration("none"); setSubtitleBackground("#000000"); setFixSubtitles(true); setFixCapitalization(false); persistSubtitleSettings({ subtitleSize: 32, subtitleColor: "#FFFFFF", subtitleBgEnabled: true, subtitleAutoDetect: true, subtitleOpacity: 100, subtitleBgOpacity: 0.75, subtitleDelay: 0, subtitleFontFamily: "Default", subtitleFontWeight: "normal", subtitleFontStyle: "normal", subtitleTextDecoration: "none", subtitleBackground: "#000000", fixSubtitles: true, fixCapitalization: false }); }} className="text-[11px] text-white/25 hover:text-white/55 transition-colors px-2 py-1 rounded-md hover:bg-white/[0.05]">Reset</button>
        </div>
        <div className="relative rounded-xl overflow-hidden flex-shrink-0 mb-4" style={{ height: 110, background: "linear-gradient(135deg, #0d0d18 0%, #0e2240 40%, #1a0e30 70%, #0d0d18 100%)" }}>
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px" }} />
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]"><div className="h-full w-[42%] bg-white/20 rounded-full" /></div>
          <div className="absolute inset-0 flex items-end justify-center pb-5">
            <span className="px-3 py-1 rounded text-center max-w-[85%] leading-snug" style={{
              fontSize: Math.min(currentSizePx * 0.52, 17),
              color: subtitleColor,
              backgroundColor: subtitleBgEnabled && subtitleBackground?.startsWith?.("#") && subtitleBackground.length >= 7 ? (() => { const hex = subtitleBackground; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${(subtitleOpacity / 100) * 0.75})`; })() : "transparent",
              fontFamily: subtitleFontFamily === "Default" ? "Arial" : subtitleFontFamily,
              fontWeight: subtitleFontWeight === "bold" ? 700 : 400,
              fontStyle: subtitleFontStyle === "italic" ? "italic" : "normal",
              textDecoration: subtitleTextDecoration === "underline" ? "underline" : "none",
              letterSpacing: "0.01em"
            }}>Here is a preview of your subtitles</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Size</span>
            <div className="flex gap-1.5">
              {SUBTITLE_SIZES.map(({ label }) => (
                <button key={label} onClick={() => handleSizeChange(label)} className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150", subtitleSizeLabel === label ? "bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]")}>{label}</button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2.5">Colour</span>
            <div className="flex items-center gap-2.5">
              {SUBTITLE_COLORS.map(({ color, label }) => (
                <button key={color} onClick={() => handleColorChange(color)} title={label}
                  className={cn("w-8 h-8 rounded-full border-[1.5px] transition-all duration-150 flex items-center justify-center flex-shrink-0", subtitleColor === color ? "scale-110" : "border-transparent hover:scale-105 opacity-60 hover:opacity-90")}
                  style={{ backgroundColor: color, borderColor: subtitleColor === color ? color === "#FFFFFF" ? "rgba(255,255,255,0.9)" : color : "transparent", boxShadow: subtitleColor === color ? `0 0 0 2px rgba(255,255,255,0.25), 0 0 10px ${color}66` : "none" }}>
                  {subtitleColor === color && <Check className="w-3.5 h-3.5" style={{ color: color === "#FFFFFF" ? "#000" : "#fff" }} strokeWidth={3} />}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-0.5" />
              <label title="Custom color" className="relative w-8 h-8 rounded-full flex-shrink-0 cursor-pointer flex items-center justify-center border-[1.5px] transition-all duration-150 overflow-hidden hover:scale-105"
                style={{ backgroundColor: subtitleColor, borderColor: !SUBTITLE_COLORS.some(c => c.color === subtitleColor) ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)", boxShadow: !SUBTITLE_COLORS.some(c => c.color === subtitleColor) ? `0 0 0 2px rgba(255,255,255,0.25), 0 0 10px ${subtitleColor}66` : "none" }}>
                {!SUBTITLE_COLORS.some(c => c.color === subtitleColor) && <Check className="w-3.5 h-3.5 relative z-10" style={{ color: subtitleColor === "#FFFFFF" ? "#000" : "#fff" }} strokeWidth={3} />}
                {SUBTITLE_COLORS.some(c => c.color === subtitleColor) && <svg className="w-3.5 h-3.5 relative z-10 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: subtitleColor === "#FFFFFF" ? "#000" : "#fff" }}><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>}
                <input type="color" value={subtitleColor} onChange={(e) => handleColorChange(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
            </div>
            <div className="mt-2.5 flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1.5">
              <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-white/20" style={{ backgroundColor: subtitleColor }} />
              <span className="text-white/30 text-xs font-mono">#</span>
              <input type="text" value={subtitleColor.replace("#", "")} maxLength={6}
                onChange={(e) => { const raw = e.target.value.replace(/[^0-9a-fA-F]/g, ""); if (raw.length === 6) handleColorChange("#" + raw.toUpperCase()); else if (raw.length < 6) setSubtitleColor("#" + raw.toUpperCase()); }}
                onBlur={(e) => { const raw = e.target.value.replace(/[^0-9a-fA-F]/g, ""); if (raw.length === 6) handleColorChange("#" + raw.toUpperCase()); }}
                placeholder="FFFFFF" className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder-white/20 outline-none min-w-0" />
            </div>
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2 mt-4">Background Colour</span>
            <div className="flex items-center gap-2 flex-wrap">
              {SUBTITLE_BG_COLORS.map(({ color, label }) => (
                <button key={color} onClick={() => { setSubtitleBackground(color); persistSubtitleSettings({ subtitleBackground: color }); }} title={label}
                  className={cn("w-8 h-8 rounded-full border-[1.5px] transition-all flex-shrink-0 flex items-center justify-center", subtitleBackground === color ? "scale-110 border-white/60" : "border-transparent hover:scale-105 opacity-70 hover:opacity-100")}
                  style={{ backgroundColor: color }}>
                  {subtitleBackground === color && <Check className="w-3.5 h-3.5" style={{ color: color === "#000000" || color === "#333333" || color === "#666666" ? "#fff" : "#000" }} strokeWidth={3} />}
                </button>
              ))}
              <label className="relative w-8 h-8 rounded-full flex-shrink-0 cursor-pointer flex items-center justify-center border-[1.5px] border-white/20 overflow-hidden" style={{ backgroundColor: subtitleBackground || "#000000" }}>
                <input type="color" value={subtitleBackground || "#000000"} onChange={(e) => { const v = e.target.value; setSubtitleBackground(v); persistSubtitleSettings({ subtitleBackground: v }); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-2.5"><span className="text-[10px] font-semibold tracking-widest text-white/30 uppercase">Opacity</span><span className="text-xs font-medium text-white/50 tabular-nums">{subtitleOpacity}%</span></div>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2"><div className="w-full h-[3px] rounded-full bg-white/[0.08]" /></div>
              <input type="range" min={0} max={100} step={1} value={subtitleOpacity} onChange={(e) => handleOpacityChange(Number(e.target.value))} className="relative w-full h-5 appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-runnable-track]:h-0 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-track]:h-0" />
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-2.5"><span className="text-[10px] font-semibold tracking-widest text-white/30 uppercase">Subtitle Delay</span><span className="text-xs font-medium text-white/50 tabular-nums">{(subtitleDelay ?? 0) >= 0 ? "+" : ""}{(subtitleDelay ?? 0).toFixed(1)}s</span></div>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2"><div className="w-full h-[3px] rounded-full bg-white/[0.08]" /></div>
              <input type="range" min={-5} max={5} step={0.1} value={subtitleDelay ?? 0} onChange={(e) => { const v = parseFloat(e.target.value); setSubtitleDelay(v); persistSubtitleSettings({ subtitleDelay: v }); }} className="relative w-full h-5 appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.5)] [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0" />
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">Negative = earlier, positive = later</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Font</span>
            <select value={subtitleFontFamily} onChange={(e) => { const v = e.target.value; setSubtitleFontFamily(v); persistSubtitleSettings({ subtitleFontFamily: v }); }} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
              {SUBTITLE_FONTS.map((f) => <option key={f.value} value={f.value} className="bg-[#111] text-white">{f.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Weight</span>
              <select value={subtitleFontWeight} onChange={(e) => { const v = e.target.value; setSubtitleFontWeight(v); persistSubtitleSettings({ subtitleFontWeight: v }); }} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
                {SUBTITLE_WEIGHTS.map((w) => <option key={w.value} value={w.value} className="bg-[#111] text-white">{w.label}</option>)}
              </select>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Style</span>
              <select value={subtitleFontStyle} onChange={(e) => { const v = e.target.value; setSubtitleFontStyle(v); persistSubtitleSettings({ subtitleFontStyle: v }); }} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
                {SUBTITLE_STYLES.map((s) => <option key={s.value} value={s.value} className="bg-[#111] text-white">{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="block text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-2">Decoration</span>
            <select value={subtitleTextDecoration} onChange={(e) => { const v = e.target.value; setSubtitleTextDecoration(v); persistSubtitleSettings({ subtitleTextDecoration: v }); }} className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20">
              {SUBTITLE_DECORATIONS.map((d) => <option key={d.value} value={d.value} className="bg-[#111] text-white">{d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Background</div><div className="text-[10px] text-white/30 mt-1">Box behind text</div></div><Toggle on={subtitleBgEnabled} onToggle={handleBgToggle} /></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Auto-detect</div><div className="text-[10px] text-white/30 mt-1">By audio track</div></div><Toggle on={subtitleAutoDetect} onToggle={handleAutoDetectToggle} /></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Fix subtitles</div><div className="text-[10px] text-white/30 mt-1">Clean up formatting</div></div><Toggle on={fixSubtitles} onToggle={() => { const next = !fixSubtitles; setFixSubtitles(next); persistSubtitleSettings({ fixSubtitles: next }); }} /></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3"><div><div className="text-xs font-medium text-white/80 leading-none">Fix capitalization</div><div className="text-[10px] text-white/30 mt-1">Sentence case</div></div><Toggle on={fixCapitalization} onToggle={() => { const next = !fixCapitalization; setFixCapitalization(next); persistSubtitleSettings({ fixCapitalization: next }); }} /></div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatsContent = () => {
    const localItems = getContinueWatchingItems();
    type AnyItem = { tmdbId: number; type: 'movie' | 'tv'; season?: number | null; episode?: number | null; progress: number; duration: number; lastWatched: number; title?: string; name?: string; poster_path?: string | null; vote_average?: number; };
    const backendAny: AnyItem[] = backendProgressItems.map(b => ({ tmdbId: b.tmdbId, type: b.type === 'MOVIE' ? 'movie' : 'tv', season: b.season, episode: b.episode, progress: b.progress, duration: b.duration, lastWatched: new Date(b.updatedAt).getTime(), title: b.title ?? undefined, poster_path: b.posterPath, vote_average: b.voteAverage ?? undefined }));
    const merged: AnyItem[] = [...backendAny];
    localItems.forEach(local => {
      const exists = merged.some(m => m.tmdbId === local.tmdbId && m.type === local.type && m.season === (local.season ?? null) && m.episode === (local.episode ?? null));
      if (!exists) merged.push({ tmdbId: local.tmdbId, type: local.type, season: local.season ?? null, episode: local.episode ?? null, progress: local.progress, duration: local.duration, lastWatched: local.lastWatched, title: local.title, name: local.name, poster_path: local.poster_path ?? null, vote_average: local.vote_average });
    });
    merged.sort((a, b) => b.lastWatched - a.lastWatched);
    const watchedItems = merged;
    const movies = watchedItems.filter(i => i.type === 'movie');
    const tvShows = watchedItems.filter(i => i.type === 'tv');
    const totalSeconds = watchedItems.reduce((acc, i) => acc + (i.progress || 0), 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const formatWatchTime = () => totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`;
    const totalTitles = watchedItems.length;
    const persona = (() => {
      if (totalTitles === 0) return { name: "New Arrival", accent: "text-white/40", desc: "Your journey starts with the first play." };
      if (totalTitles <= 3) return { name: "Casual Viewer", accent: "text-white/40", desc: "You watch for fun every now and then." };
      if (totalTitles <= 10) return { name: "Regular Watcher", accent: "text-blue-400", desc: "You've built yourself a solid viewing habit." };
      if (totalTitles <= 25) return { name: "Binge Watcher", accent: "text-purple-400", desc: "Once you start, you can't stop." };
      return { name: "Cinephile", accent: "text-amber-400", desc: "Movies and shows are your second language." };
    })();
    const moviePct = watchedItems.length > 0 ? Math.round((movies.length / watchedItems.length) * 100) : 0;
    const tvPct = watchedItems.length > 0 ? Math.round((tvShows.length / watchedItems.length) * 100) : 0;
    const splitItems = [{ label: "Movies", pct: moviePct }, { label: "TV Shows", pct: tvPct }].filter(i => i.pct > 0).sort((a, b) => b.pct - a.pct);

    return (
      <div className="flex-1 flex flex-col gap-5 min-h-0">
        <div><h2 className="text-xl font-bold text-white tracking-tight">Your Stats</h2><p className="text-sm text-white/35 mt-0.5">Insights into your viewing habits and history.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"><div><div className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1">Time Watched</div><div className="text-2xl font-bold text-white leading-none">{formatWatchTime()}</div></div><svg className="w-8 h-8 text-white/10 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"><div><div className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1">Titles Watched</div><div className="text-2xl font-bold text-white leading-none">{totalTitles}</div></div><svg className="w-8 h-8 text-white/10 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3H8" /><path d="M20 3H4" strokeOpacity="0.5" /></svg></div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-3">Your Persona</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></div>
            <div><div className="text-base font-semibold leading-none"><span className="text-white">{persona.name.split(" ")[0]} </span><span className={persona.accent}>{persona.name.split(" ").slice(1).join(" ")}</span></div><div className="text-xs text-white/35 mt-1">{persona.desc}</div></div>
          </div>
        </div>
        {(genreData.length > 0 || genresLoading) && (
          <div>
            <div className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-3">Top Genres</div>
            {genresLoading && genreData.length === 0 ? (
              <div className="space-y-3">{[80, 65, 45].map(w => <div key={w} className="flex items-center gap-3 animate-pulse"><div className="w-4 h-3 bg-white/10 rounded" /><div className="flex-1"><div className="h-3 bg-white/10 rounded mb-1.5" style={{ width: `${w}%` }} /><div className="h-[3px] bg-white/[0.07] rounded-full" /></div><div className="w-7 h-3 bg-white/10 rounded" /></div>)}</div>
            ) : (
              <div className="space-y-3">{genreData.map((item, idx) => <div key={item.name} className="flex items-center gap-3"><div className="text-xs text-white/25 w-4 flex-shrink-0 text-right">#{idx + 1}</div><div className="flex-1"><div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold text-white">{item.name}</span><span className="text-xs text-white/35">{item.pct}%</span></div><div className="h-[3px] bg-white/[0.07] rounded-full overflow-hidden"><div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${item.pct}%` }} /></div></div></div>)}</div>
            )}
          </div>
        )}
        {splitItems.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-3">Content Split</div>
            <div className="space-y-3">{splitItems.map(item => <div key={item.label} className="flex items-center gap-3"><div className="flex-1"><div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold text-white">{item.label}</span><span className="text-xs text-white/35">{item.pct}%</span></div><div className="h-[3px] bg-white/[0.07] rounded-full overflow-hidden"><div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${item.pct}%` }} /></div></div></div>)}</div>
          </div>
        )}
        {watchedItems.length === 0 && <div className="flex-1 flex flex-col items-center justify-center text-center py-10"><svg className="w-10 h-10 text-white/10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg><div className="text-sm font-medium text-white/40">No activity yet</div><div className="text-xs text-white/20 mt-1">Start watching to see your stats here</div></div>}
      </div>
    );
  };

  const renderAboutContent = () => (
    <div className="space-y-6 h-full flex flex-col">
      <div><h2 className="text-xl font-semibold text-white">About</h2><p className="text-sm text-white/40 mt-1">App information & credits</p></div>
      <div className="space-y-3 flex-1">
        <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-lg"><div className="text-xs text-white/40 mb-1">Version</div><div className="text-base font-medium text-white">{version}</div></div>
        <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-lg"><div className="text-xs text-white/40 mb-1">Built with</div><div className="text-sm text-white/70">React, TypeScript, Tailwind CSS</div></div>
      </div>
    </div>
  );

  const sidebarItems = isElectronApp()
    ? [...baseSidebarItems, appSidebarItem]
    : baseSidebarItems;

  const renderAppContent = () => {
    const electron = getElectronAPI();
    const platform = electron?.platform ?? "unknown";
    const platformLabel =
      platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : platform === "linux" ? "Linux" : platform;

    return (
      <div className="space-y-6 h-full flex flex-col">
        <div>
          <h2 className="text-xl font-semibold text-white">App</h2>
          <p className="text-sm text-white/40 mt-1">Desktop app settings & built-in extension</p>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Puzzle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Built-in Extension</div>
                <div className="text-xs text-white/40 mt-0.5">Enabled — extension-required sources (Pasmells, Vixsrc, Videasy) work without installing a browser extension</div>
              </div>
              <div className="ml-auto flex items-center gap-2 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">Active</span>
              </div>
            </div>
          </div>
          <UpdateCard />
          <WarpSettingsCard />
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="text-xs text-white/40 mb-1">Platform</div>
              <div className="text-sm font-medium text-white">{platformLabel}</div>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="text-xs text-white/40 mb-1">App Version</div>
              <div className="text-sm font-medium text-white">{version}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "user": return renderUserContent();
      case "account": return renderAccountContent();
      case "appearance": return renderAppearanceContent();
      case "preferences": return renderPreferencesContent();
      case "subtitles": return renderSubtitlesContent();
      case "stats": return renderStatsContent();
      case "about": return renderAboutContent();
      case "app": return renderAppContent();
      default: return renderAppearanceContent();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop — separate fixed layer, receives outside clicks */}
      <button
        type="button"
        className={cn("fixed inset-0 z-[9999] bg-black/85 backdrop-blur-[2px] border-0 p-0 cursor-default", isClosing && "opacity-0 transition-opacity duration-150")}
        onClick={handleClose}
        aria-label="Close"
      />
      {/* Modal wrapper — pointer-events-none so clicks pass through to backdrop when outside modal */}
      <div className={cn("fixed inset-0 z-[10000] flex items-end sm:items-center justify-center pt-8 sm:pt-4 pb-16 sm:pb-4 px-2 sm:px-4 pointer-events-none", isClosing && "opacity-0 transition-opacity duration-150")}>
        <div
          className={cn(
            "relative w-full max-w-4xl overflow-hidden [&_button]:cursor-pointer pointer-events-auto",
            "border border-white/[0.08] rounded-t-2xl rounded-b-2xl sm:rounded-2xl",
            "shadow-[0_32px_64px_rgba(0,0,0,0.6)]",
            "will-change-transform",
            "h-[78vh] sm:h-[720px] sm:max-h-[90vh]",
            isClosing
              ? "opacity-0 scale-[0.97] transition-[opacity,transform] duration-150 ease-in"
              : "opacity-100 scale-100 transition-[opacity,transform] duration-200 ease-out"
          )}
          style={{ backgroundColor: currentTheme.contentColor, transform: isClosing ? "scale(0.97)" : "scale(1)", "--modal-accent": currentTheme.accentColor } as React.CSSProperties}
        >
        <button
          onClick={handleClose}
          className="hidden sm:inline-flex absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-[var(--modal-accent)]/10 hover:text-[var(--modal-accent)] transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex h-full min-h-0">
          {/* Sidebar — User, Account, Appearance, etc., App on the left */}
          <nav className="flex-shrink-0 w-44 sm:w-48 border-r border-white/[0.06] flex flex-col py-4 overflow-y-auto">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium text-left transition-all",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white/70"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Content area */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin flex flex-col p-4 sm:p-5 pr-10 sm:pr-14" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              {renderContent()}
            </div>
          </div>
        </div>
        </div>
      </div>

      <ChangePasswordModal isOpen={showChangePasswordModal} onClose={() => setShowChangePasswordModal(false)} />
    </>,
    document.body
  );
};

export default SettingsModal;