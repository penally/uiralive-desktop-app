/**
 * Discord Rich Presence - updates based on route and player state.
 * Only active when running in Electron app.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getElectronAPI } from "@/lib/electron";

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
  return pathname.startsWith("/movie/watch/") || pathname.startsWith("/tv/watch/");
}

export function DiscordRPCProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const api = getElectronAPI();

  useEffect(() => {
    if (!api?.rpcSetActivity) return;

    const pathname = location.pathname;

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
  }, [location.pathname, api]);

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
  const lastUpdateRef = useRef(0);
  const lastIsPlayingRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!api?.rpcSetActivity) return;
    if (!props) return;

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

    const throttle = 15000;
    const t = Date.now();
    const isPlayingChanged = lastIsPlayingRef.current !== isPlaying;
    lastIsPlayingRef.current = isPlaying;

    const shouldUpdate =
      isPlayingChanged ||
      !isPlaying ||
      t - lastUpdateRef.current > throttle;

    if (shouldUpdate) {
      lastUpdateRef.current = t;
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
