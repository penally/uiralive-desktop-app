/**
 * Backend API helpers - thin wrappers around fetch that handle auth headers.
 * All functions are fire-and-forget safe: they never throw (errors are logged).
 */

import { config } from '@/lib/config';

export function apiUrl(path: string): string {
  const base = config.backend.baseUrl || '';
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

function getToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ─── Watch Progress ───────────────────────────────────────────────────────────

export interface BackendProgress {
  tmdbId: number;
  type: 'MOVIE' | 'SERIES';
  season?: number | null;
  episode?: number | null;
  progress: number;
  duration: number;
  title?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number | null;
  updatedAt: string;
}

export async function fetchAllProgress(): Promise<BackendProgress[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch(apiUrl('/api/progress'), { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as BackendProgress[];
  } catch {
    return [];
  }
}

export async function fetchProgress(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
): Promise<BackendProgress | null> {
  if (!getToken()) return null;
  try {
    const params = new URLSearchParams({ type });
    if (season != null) params.set('season', String(season));
    if (episode != null) params.set('episode', String(episode));
    const res = await fetch(apiUrl(`/api/progress/${tmdbId}?${params}`), { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as BackendProgress | null;
  } catch {
    return null;
  }
}

export async function saveProgressToBackend(payload: {
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  progress: number;
  duration: number;
  title?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number;
}): Promise<void> {
  if (!getToken()) return;
  try {
    await fetch(apiUrl('/api/progress'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  } catch {
    // silent — localStorage is the source of truth fallback
  }
}

export async function deleteProgressFromBackend(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
): Promise<void> {
  if (!getToken()) return;
  try {
    const params = new URLSearchParams({ type });
    if (season != null) params.set('season', String(season));
    if (episode != null) params.set('episode', String(episode));
    await fetch(apiUrl(`/api/progress/${tmdbId}?${params}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    // silent
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface BackendSession {
  id: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export async function fetchSessions(): Promise<BackendSession[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch(apiUrl('/api/sessions'), { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as BackendSession[];
  } catch {
    return [];
  }
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function revokeAllOtherSessions(): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl('/api/sessions'), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Player / Subtitle Settings ──────────────────────────────────────────────

export interface BackendPlayerSettings {
  subtitleSize?: number;
  subtitleColor?: string;
  subtitleBackground?: string;
  subtitleBgOpacity?: number;
  subtitleShadow?: string;
  subtitleBgEnabled?: boolean;
  subtitleAutoDetect?: boolean;
  subtitleOpacity?: number;
  subtitleFontFamily?: string;
  subtitleFontWeight?: string;
  subtitleFontStyle?: string;
  subtitleTextDecoration?: string;
  subtitleDelay?: number;
  fixSubtitles?: boolean;
  fixCapitalization?: boolean;
  volume?: number;
  playbackRate?: number;
  autoQuality?: boolean;
}

export async function fetchPlayerSettings(): Promise<BackendPlayerSettings | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch(apiUrl('/api/player-settings'), { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || Object.keys(data).length === 0) return null;
    return data as BackendPlayerSettings;
  } catch {
    return null;
  }
}

export async function savePlayerSettingsToBackend(settings: BackendPlayerSettings): Promise<void> {
  if (!getToken()) return;
  try {
    await fetch(apiUrl('/api/player-settings'), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(settings),
    });
  } catch {
    // silent
  }
}

// ─── Admin (locked content, user search) ─────────────────────────────────────

export interface LockedContentItem {
  id: number;
  tmdbId: number;
  type: 'MOVIE' | 'SERIES';
  season: number | null;
  episode: number | null;
  reason: string | null;
  createdAt: string;
}

export async function checkContentLocked(
  tmdbId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<{ locked: boolean; reason?: string }> {
  try {
    const params = new URLSearchParams({ tmdbId: String(tmdbId), type });
    if (season != null) params.set('season', String(season));
    if (episode != null) params.set('episode', String(episode));
    const res = await fetch(apiUrl(`/api/admin/locked/check?${params}`), { headers: authHeaders() });
    if (!res.ok) return { locked: false };
    return (await res.json()) as { locked: boolean; reason?: string };
  } catch {
    return { locked: false };
  }
}

export interface SeasonLockResult {
  episodes: Record<number, { reason?: string }>;
  wholeSeason?: { reason?: string } | null;
  wholeShow?: { reason?: string } | null;
}

export async function checkSeasonLocked(
  tmdbId: number,
  season: number
): Promise<SeasonLockResult> {
  try {
    const params = new URLSearchParams({ tmdbId: String(tmdbId), type: 'tv', season: String(season) });
    const res = await fetch(apiUrl(`/api/admin/locked/check?${params}`), { headers: authHeaders() });
    if (!res.ok) return { episodes: {} };
    const data = await res.json();
    return {
      episodes: data.episodes ?? {},
      wholeSeason: data.wholeSeason ?? null,
      wholeShow: data.wholeShow ?? null,
    };
  } catch {
    return { episodes: {} };
  }
}

export async function fetchLockedContent(): Promise<LockedContentItem[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch(apiUrl('/api/admin/locked'), { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as LockedContentItem[];
  } catch {
    return [];
  }
}

export async function lockContent(payload: {
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  reason?: string;
}): Promise<LockedContentItem | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch(apiUrl('/api/admin/locked'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as LockedContentItem;
  } catch {
    return null;
  }
}

export async function unlockContent(id: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/locked/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface AdminUser {
  id: number;
  email: string;
  displayName: string;
  username: string | null;
  avatar: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  isApproved?: boolean;
  commentBlocked?: boolean;
  createdAt: string;
  updatedAt?: string;
  timeWatchedSeconds?: number;
}

export async function fetchRecentUsers(): Promise<AdminUser[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch(apiUrl("/api/admin/users/recent"), {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return (await res.json()) as AdminUser[];
  } catch {
    return [];
  }
}

export async function searchUsers(q: string): Promise<AdminUser[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch(apiUrl(`/api/admin/users?q=${encodeURIComponent(q)}&limit=50`), {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return (await res.json()) as AdminUser[];
  } catch {
    return [];
  }
}

export async function approveUser(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/approve`), {
      method: "POST",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function rejectUser(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/reject`), {
      method: "POST",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function promoteUserToAdmin(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/promote`), {
      method: "POST",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function demoteUserFromAdmin(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/demote`), {
      method: "POST",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function blockUserComments(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/block-comments`), {
      method: "POST",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unblockUserComments(userId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/unblock-comments`), {
      method: "POST",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchUserComments(userId: number): Promise<AdminComment[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/comments`), { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as AdminComment[];
  } catch {
    return [];
  }
}

// ─── Comments ───────────────────────────────────────────────────────────────

export interface CommentItem {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; displayName: string; avatar: string | null; isAdmin?: boolean; isOwner?: boolean };
}

export interface AdminComment {
  id: number;
  userId: number;
  tmdbId: number;
  type: string;
  content: string;
  createdAt: string;
}

export async function fetchComments(tmdbId: number, type: "movie" | "tv"): Promise<CommentItem[]> {
  try {
    const res = await fetch(apiUrl(`/api/comments?tmdbId=${tmdbId}&type=${type}`), { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as CommentItem[];
  } catch {
    return [];
  }
}

export async function postComment(
  tmdbId: number,
  type: "movie" | "tv",
  content: string
): Promise<{ comment: CommentItem | null; error?: string }> {
  if (!getToken()) return { comment: null, error: "Sign in to comment" };
  try {
    const res = await fetch(apiUrl("/api/comments"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ tmdbId, type, content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { comment: null, error: data.error || "Failed to post comment" };
    return { comment: data as CommentItem };
  } catch {
    return { comment: null, error: "Network error" };
  }
}

export interface SimilarItem {
  thirdPartyId: string;
  title: string;
  description?: string;
  image?: string;
  imageBackdrop?: string;
  categories?: string[];
  /** Some Likewise items use singular `category` instead of `categories` */
  category?: string;
  releaseDate?: string;
  firstAirDate?: string;
  averageRating?: number;
}

export async function fetchSimilar(
  tmdbId: number,
  type: "movie" | "tv",
  locale?: string
): Promise<SimilarItem[]> {
  try {
    const lang = locale ?? (typeof window !== "undefined" ? (() => {
      try {
        const stored = localStorage.getItem("uira-language");
        return stored && stored.trim() ? stored : "en-US";
      } catch {
        return "en-US";
      }
    })() : "en-US");
    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      type: type === "tv" ? "tv" : "movie",
      locale: lang,
    });
    const res = await fetch(apiUrl(`/api/similar?${params}`), { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as SimilarItem[];
  } catch {
    return [];
  }
}

export async function deleteComment(commentId: number): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch(apiUrl(`/api/comments/${commentId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
