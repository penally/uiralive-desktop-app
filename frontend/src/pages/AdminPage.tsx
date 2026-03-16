import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import {
  Lock,
  Unlock,
  Users,
  Search,
  Shield,
  Plus,
  Loader2,
  Film,
  Tv,
  UserPlus,
  UserMinus,
  UserCheck,
  Trash2,
  MessageSquare,
  Ban,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import {
  fetchLockedContent,
  lockContent,
  unlockContent,
  fetchRecentUsers,
  searchUsers,
  approveUser,
  rejectUser,
  promoteUserToAdmin,
  demoteUserFromAdmin,
  deleteUser,
  blockUserComments,
  unblockUserComments,
  fetchUserComments,
  deleteComment,
  type LockedContentItem,
  type AdminUser,
  type AdminComment,
} from "@/lib/api/backend";

type AdminTab = "locks" | "users";

const AdminPage: React.FC = () => {
  usePageTitle("Admin • Uira.Live");
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("locks");

  const [locks, setLocks] = useState<LockedContentItem[]>([]);
  const [locksLoading, setLocksLoading] = useState(true);
  const [lockForm, setLockForm] = useState({
    tmdbId: "",
    type: "movie" as "movie" | "tv",
    season: "",
    episode: "",
    reason: "",
  });
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [lockError, setLockError] = useState("");

  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [recentUsersLoading, setRecentUsersLoading] = useState(false);
  const [userSearchDebounce, setUserSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [userActionId, setUserActionId] = useState<number | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [userComments, setUserComments] = useState<AdminComment[]>([]);
  const [userCommentsLoading, setUserCommentsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate("/");
      return;
    }
  }, [isAuthenticated, user?.isAdmin, navigate]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    const load = async () => {
      setLocksLoading(true);
      const data = await fetchLockedContent();
      setLocks(data);
      setLocksLoading(false);
    };
    void load();
  }, [user?.isAdmin]);

  useEffect(() => {
    if (activeTab !== "users") return;
    setRecentUsersLoading(true);
    fetchRecentUsers().then((data) => {
      setRecentUsers(data);
      setRecentUsersLoading(false);
    });
  }, [activeTab]);

  useEffect(() => {
    if (userQuery.length < 2) {
      setUsers([]);
      return;
    }
    if (userSearchDebounce) clearTimeout(userSearchDebounce);
    const t = setTimeout(async () => {
      setUsersLoading(true);
      const data = await searchUsers(userQuery);
      setUsers(data);
      setUsersLoading(false);
    }, 300);
    setUserSearchDebounce(t);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [userQuery]);

  const handleLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLockError("");
    const tmdbId = Number(lockForm.tmdbId);
    if (!tmdbId || Number.isNaN(tmdbId)) {
      setLockError("Valid TMDB ID required");
      return;
    }
    setLockSubmitting(true);
    const lock = await lockContent({
      tmdbId,
      type: lockForm.type,
      season: lockForm.season ? Number(lockForm.season) : undefined,
      episode: lockForm.episode ? Number(lockForm.episode) : undefined,
      reason: lockForm.reason || undefined,
    });
    setLockSubmitting(false);
    if (lock) {
      setLocks((prev) => [...prev, lock].sort((a, b) => a.tmdbId - b.tmdbId));
      setLockForm({ tmdbId: "", type: "movie", season: "", episode: "", reason: "" });
    } else {
      setLockError("Failed to lock content");
    }
  };

  const handleUnlock = async (id: number) => {
    const ok = await unlockContent(id);
    if (ok) setLocks((prev) => prev.filter((l) => l.id !== id));
  };

  const refreshRecentUsers = () => {
    fetchRecentUsers().then(setRecentUsers);
  };

  const handlePromote = async (u: AdminUser) => {
    setUserActionId(u.id);
    const ok = await promoteUserToAdmin(u.id);
    setUserActionId(null);
    if (ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: true } : x)));
      refreshRecentUsers();
    }
  };

  const handleDemote = async (u: AdminUser) => {
    setUserActionId(u.id);
    const ok = await demoteUserFromAdmin(u.id);
    setUserActionId(null);
    if (ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: false } : x)));
      refreshRecentUsers();
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.displayName} (${u.email})? This cannot be undone.`)) return;
    setUserActionId(u.id);
    const ok = await deleteUser(u.id);
    setUserActionId(null);
    if (ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      if (expandedUserId === u.id) setExpandedUserId(null);
      refreshRecentUsers();
    }
  };

  const handleBlockComments = async (u: AdminUser) => {
    setUserActionId(u.id);
    const ok = await blockUserComments(u.id);
    setUserActionId(null);
    if (ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, commentBlocked: true } : x)));
      refreshRecentUsers();
    }
  };

  const handleUnblockComments = async (u: AdminUser) => {
    setUserActionId(u.id);
    const ok = await unblockUserComments(u.id);
    setUserActionId(null);
    if (ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, commentBlocked: false } : x)));
      refreshRecentUsers();
    }
  };

  const toggleUserComments = async (u: AdminUser) => {
    if (expandedUserId === u.id) {
      setExpandedUserId(null);
      setUserComments([]);
      return;
    }
    setExpandedUserId(u.id);
    setUserCommentsLoading(true);
    const data = await fetchUserComments(u.id);
    setUserComments(data);
    setUserCommentsLoading(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    const ok = await deleteComment(commentId);
    if (ok) setUserComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleApprove = async (u: AdminUser) => {
    setUserActionId(u.id);
    const ok = await approveUser(u.id);
    setUserActionId(null);
    if (ok) {
      setRecentUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isApproved: true } : x)));
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isApproved: true } : x)));
    }
  };

  const handleReject = async (u: AdminUser) => {
    setUserActionId(u.id);
    const ok = await rejectUser(u.id);
    setUserActionId(null);
    if (ok) {
      setRecentUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isApproved: false } : x)));
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isApproved: false } : x)));
    }
  };

  const formatLockLabel = (l: LockedContentItem) => {
    const type = l.type === "MOVIE" ? "Movie" : "TV";
    const extra =
      l.type === "SERIES" && (l.season != null || l.episode != null)
        ? ` S${l.season ?? "?"}E${l.episode ?? "?"}`
        : "";
    return `${type} #${l.tmdbId}${extra}`;
  };

  const formatTimeWatched = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${Math.round(seconds)}s`;
  };

  if (!isAuthenticated || !user?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)]">
      <SidebarNav />
      <main className="pl-16 md:pl-20 py-8 px-4 md:px-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-white/60 text-sm">Lock content & search users</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("locks")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "locks"
                ? "bg-white/15 text-white border border-white/20"
                : "bg-white/5 text-white/70 hover:bg-white/10 border border-transparent"
            }`}
          >
            <Lock className="inline w-4 h-4 mr-2 -mt-0.5" />
            Locked Content
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "users"
                ? "bg-white/15 text-white border border-white/20"
                : "bg-white/5 text-white/70 hover:bg-white/10 border border-transparent"
            }`}
          >
            <Users className="inline w-4 h-4 mr-2 -mt-0.5" />
            Users
          </button>
        </div>

        {activeTab === "locks" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Lock new content
              </h2>
              <form onSubmit={handleLockSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">TMDB ID</label>
                    <input
                      type="number"
                      value={lockForm.tmdbId}
                      onChange={(e) => setLockForm((f) => ({ ...f, tmdbId: e.target.value }))}
                      placeholder="e.g. 1236153"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Type</label>
                    <select
                      value={lockForm.type}
                      onChange={(e) =>
                        setLockForm((f) => ({ ...f, type: e.target.value as "movie" | "tv" }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                      <option value="movie">Movie</option>
                      <option value="tv">TV Show</option>
                    </select>
                  </div>
                </div>
                {lockForm.type === "tv" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/60 mb-1">Season (optional)</label>
                      <input
                        type="number"
                        value={lockForm.season}
                        onChange={(e) => setLockForm((f) => ({ ...f, season: e.target.value }))}
                        placeholder="Whole show if empty"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/60 mb-1">Episode (optional)</label>
                      <input
                        type="number"
                        value={lockForm.episode}
                        onChange={(e) => setLockForm((f) => ({ ...f, episode: e.target.value }))}
                        placeholder="Whole season if empty"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-white/60 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={lockForm.reason}
                    onChange={(e) => setLockForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Copyright claim, DMCA"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                {lockError && <p className="text-red-400 text-sm">{lockError}</p>}
                <button
                  type="submit"
                  disabled={lockSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 transition"
                >
                  {lockSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Lock content
                </button>
              </form>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Currently locked</h2>
              {locksLoading ? (
                <div className="flex items-center gap-2 text-white/60 py-8">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading…
                </div>
              ) : locks.length === 0 ? (
                <p className="text-white/50 py-8">No locked content.</p>
              ) : (
                <ul className="space-y-2">
                  {locks.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-4 py-3 px-4 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {l.type === "MOVIE" ? (
                          <Film className="w-5 h-5 text-white/50 flex-shrink-0" />
                        ) : (
                          <Tv className="w-5 h-5 text-white/50 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{formatLockLabel(l)}</p>
                          {l.reason && (
                            <p className="text-sm text-white/50 truncate">{l.reason}</p>
                          )}
                        </div>
                      </div>
                      <a
                        href={
                          l.type === "MOVIE"
                            ? `/movie/watch/${l.tmdbId}`
                            : `/tv/watch/${l.tmdbId}/${l.season ?? 1}/${l.episode ?? 1}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/40 hover:text-white/70"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleUnlock(l.id)}
                        className="p-2 rounded-lg text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition"
                        title="Unlock"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {activeTab === "users" && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recently updated (10 latest)
            </h2>
            {recentUsersLoading ? (
              <div className="flex items-center gap-2 text-white/60 py-6">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading…
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-white/50 text-sm py-4">No users yet.</p>
            ) : (
              <ul className="space-y-2 mb-6">
                {recentUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <Users className="w-4 h-4 text-white/50" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{u.displayName}</p>
                        <p className="text-xs text-white/50 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {u.isApproved ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {u.timeWatchedSeconds != null && u.timeWatchedSeconds > 0 && (
                        <span className="text-xs text-white/50 tabular-nums">
                          {formatTimeWatched(u.timeWatchedSeconds)}
                        </span>
                      )}
                      <span className="text-xs text-white/40 tabular-nums">
                        {u.updatedAt
                          ? new Date(u.updatedAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 mt-8">
              <Search className="w-5 h-5" />
              Search users
            </h2>
            <p className="text-white/50 text-sm mb-4">
              Search by email or display name (min 2 characters)
            </p>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Email or display name…"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 mb-4"
            />
            {usersLoading ? (
              <div className="flex items-center gap-2 text-white/60 py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching…
              </div>
            ) : users.length === 0 && userQuery.length >= 2 ? (
              <p className="text-white/50 py-8">No users found.</p>
            ) : users.length > 0 ? (
              <ul className="space-y-2">
                {users.map((u) => {
                  const isSelf = String(u.id) === user?.id;
                  const canModify = user?.isOwner && !isSelf && !u.isOwner;
                  const canAdmin = user?.isAdmin && !isSelf && !u.isOwner;
                  const isActing = userActionId === u.id;
                  const isExpanded = expandedUserId === u.id;
                  return (
                    <li
                      key={u.id}
                      className="rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-4 py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-white/50" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{u.displayName}</p>
                            <p className="text-sm text-white/50 truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {u.isOwner && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-400 border border-violet-500/30">
                              Owner
                            </span>
                          )}
                          {u.isAdmin && !u.isOwner && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Admin
                            </span>
                          )}
                          {u.isApproved ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              Approved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Pending
                            </span>
                          )}
                          {u.commentBlocked && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                              Blocked
                            </span>
                          )}
                          {canAdmin && (
                            <>
                              {!u.isOwner && !u.isAdmin && (
                                u.isApproved ? (
                                  <button
                                    onClick={() => handleReject(u)}
                                    disabled={isActing}
                                    className="p-2 rounded-lg text-orange-400/80 hover:bg-orange-500/10 hover:text-orange-400 transition disabled:opacity-50"
                                    title="Revoke access (pending approval)"
                                  >
                                    {isActing ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleApprove(u)}
                                    disabled={isActing}
                                    className="p-2 rounded-lg text-green-400/80 hover:bg-green-500/10 hover:text-green-400 transition disabled:opacity-50"
                                    title="Approve (allow to watch)"
                                  >
                                    {isActing ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <UserCheck className="w-4 h-4" />
                                    )}
                                  </button>
                                )
                              )}
                              <button
                                onClick={() => toggleUserComments(u)}
                                className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition"
                                title="View comments"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              {u.commentBlocked ? (
                                <button
                                  onClick={() => handleUnblockComments(u)}
                                  disabled={isActing}
                                  className="p-2 rounded-lg text-green-400/80 hover:bg-green-500/10 hover:text-green-400 transition disabled:opacity-50"
                                  title="Unblock from commenting"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBlockComments(u)}
                                  disabled={isActing}
                                  className="p-2 rounded-lg text-orange-400/80 hover:bg-orange-500/10 hover:text-orange-400 transition disabled:opacity-50"
                                  title="Block from commenting"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                          {canModify && (
                            <>
                              {!u.isAdmin ? (
                                <button
                                  onClick={() => handlePromote(u)}
                                  disabled={isActing}
                                  className="p-2 rounded-lg text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-400 transition disabled:opacity-50"
                                  title="Promote to admin"
                                >
                                  {isActing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <UserPlus className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDemote(u)}
                                  disabled={isActing}
                                  className="p-2 rounded-lg text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-400 transition disabled:opacity-50"
                                  title="Demote from admin"
                                >
                                  {isActing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <UserMinus className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={isActing}
                                className="p-2 rounded-lg text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition disabled:opacity-50"
                                title="Delete account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-white/5 px-4 py-4 bg-black/20">
                          <h4 className="text-sm font-medium text-white/80 mb-3">Comments</h4>
                          {userCommentsLoading ? (
                            <div className="flex items-center gap-2 text-white/60 py-4">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading…
                            </div>
                          ) : userComments.length === 0 ? (
                            <p className="text-white/50 text-sm py-2">No comments.</p>
                          ) : (
                            <ul className="space-y-2 max-h-64 overflow-y-auto">
                              {userComments.map((c) => (
                                <li
                                  key={c.id}
                                  className="flex items-start justify-between gap-2 py-2 px-3 rounded-lg bg-white/5 border border-white/5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-white/90 text-sm break-words">{c.content}</p>
                                    <p className="text-white/40 text-xs mt-1">
                                      {c.type} #{c.tmdbId} • {new Date(c.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="p-1.5 rounded text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition flex-shrink-0"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
