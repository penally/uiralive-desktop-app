/**
 * Discord Rich Presence - updates based on route and player state.
 * Only active when running in Electron app.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getElectronAPI, isElectronApp } from "@/lib/electron";

/** HashRouter stores path in hash; use it as fallback when React Router location may lag */
function getPathname(location: { pathname: string }): string {
  if (typeof window === "undefined") return location.pathname;
  const hash = window.location.hash;
  if (isElectronApp() && hash) {
    const fromHash = hash.replace(/^#/, "").split("?")[0] || "/";
    if (fromHash.startsWith("/")) return fromHash;
    return "/" + fromHash;
  }
  return location.pathname;
}

const ROUTE_PRESENCE: Record<string, { details: string; state?: string }> = {
  "/": { details: "Browsing Home", state: "Home" },
  "/movie": { details: "Browsing Movies", state: "Movies" },
  "/tv": { details: "Browsing TV Shows", state: "TV Shows" },
  "/anime": { details: "Browsing Anime", state: "Anime" },
  "/trending": { details: "Browsing Trending", state: "Trending" },
  "/categories": { details: "Browsing Categories", state: "Categories" },
  "/search": { details: "Searching", state: "Search" },
  "/admin": { details: "Admin", state: "Admin" },
};

function getRoutePresence(pathname: string) {
  for (const [path, presence] of Object.entries(ROUTE_PRESENCE)) {
    if (pathname === path || (path !== "/" && pathname.startsWith(path + "/"))) {
      return presence;
    }
  }
  return null;
}

function isWatchPage(pathname: string) {
  return (
    pathname.startsWith("/movie/watch/") ||
    pathname.startsWith("/tv/watch/") ||
    pathname.startsWith("/anime/watch/")
  );
}

export function DiscordRPCProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const api = getElectronAPI();
  const [hashTick, setHashTick] = useState(0);

  useEffect(() => {
    if (!isElectronApp()) return;
    const onHashChange = () => setHashTick((n) => n + 1);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!api?.rpcSetActivity) return;

    const pathname = getPathname(location);

    if (isWatchPage(pathname)) {
      return;
    }

    const send = () => {
      const presence = getRoutePresence(pathname);
      if (presence) {
        api.rpcSetActivity({
          details: presence.details,
          state: presence.state,
          largeImageKey: "logo",
          largeImageText: "Uira Live",
        });
      } else {
        api.rpcSetActivity({
          details: "Uira Live",
          state: pathname || "Home",
          largeImageKey: "logo",
          largeImageText: "Uira Live",
        });
      }
    };

    send();
    const retry = setTimeout(send, 3000);
    return () => clearTimeout(retry);
  }, [location, api, hashTick]);

  return <>{children}</>;
}

export interface DiscordRPCPlayerProps {
  title: string;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  posterUrl?: string;
}

export function useDiscordRPCPlayer(props: DiscordRPCPlayerProps | null) {
  const api = getElectronAPI();
  const lastIsPlayingRef = useRef<boolean | null>(null);
  const lastContentRef = useRef<string>("");

  useEffect(() => {
    if (!api?.rpcSetActivity) return;

    if (!props) {
      api.rpcSetActivity({
        details: "Watching",
        state: "Loading...",
        largeImageKey: "logo",
        largeImageText: "Uira Live",
      });
      return;
    }

    const { title, season, episode, currentTime, duration, isPlaying, posterUrl } = props;

    const details = season != null && episode != null
      ? `${title} • S${season}E${episode}`
      : title;

    const ts = Math.floor(Date.now() / 1000);
    const dur = Number(duration);
    const cur = Number(currentTime);
    const isValidDuration = Number.isFinite(dur) && dur > 0 && cur >= 0 && cur <= dur;
    const remaining = isValidDuration ? Math.max(0, dur - cur) : 0;

    let startTimestamp: number | undefined;
    let endTimestamp: number | undefined;
    if (isPlaying && isValidDuration) {
      startTimestamp = Math.floor(ts - cur);
      endTimestamp = Math.floor(ts + remaining);
      if (startTimestamp < 0 || endTimestamp <= startTimestamp) {
        startTimestamp = undefined;
        endTimestamp = undefined;
      }
    }

    const presence = {
      details,
      state: isPlaying ? "Watching" : "Paused",
      largeImageKey: posterUrl || "logo",
      largeImageText: title,
      smallImageKey: isPlaying ? "play" : "pause",
      smallImageText: isPlaying ? "Playing" : "Paused",
      startTimestamp,
      endTimestamp,
    };

    const contentKey = `${title}|${season ?? ""}|${episode ?? ""}`;
    const contentChanged = lastContentRef.current !== contentKey;
    lastContentRef.current = contentKey;

    const isPlayingChanged = lastIsPlayingRef.current !== isPlaying;
    lastIsPlayingRef.current = isPlaying;

    const shouldUpdate = isPlayingChanged || contentChanged;

    if (shouldUpdate) {
      api.rpcSetActivity(presence);
    }
  }, [
    api,
    props?.title,
    props?.season,
    props?.episode,
    props?.currentTime,
    props?.duration,
    props?.isPlaying,
    props?.posterUrl,
  ]);
}
