import "dotenv/config";
import express, { Response } from "express";
import { PrismaClient } from "../../generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { authenticateToken, requireApproved, AuthRequest } from "../middleware/auth.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

async function requireAdmin(req: AuthRequest, res: Response, next: express.NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Authentication required" });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.isAdmin) return res.status(403).json({ error: "Admin access required" });
    next();
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function requireOwner(req: AuthRequest, res: Response, next: express.NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Authentication required" });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.isOwner) return res.status(403).json({ error: "Owner access required" });
    next();
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

// Check if content is locked (requires JWT + approved account)
// For movies: ?tmdbId=&type=movie
// For single episode: ?tmdbId=&type=tv&season=&episode=
// For whole season (all episodes): ?tmdbId=&type=tv&season= → returns { episodes: { [epNum]: { reason? } }, wholeSeason?, wholeShow? }
router.get("/locked/check", requireApproved, async (req, res) => {
  const tmdbId = req.query.tmdbId ? Number(req.query.tmdbId) : null;
  const type = req.query.type as string | undefined;
  const season = req.query.season ? Number(req.query.season) : null;
  const episode = req.query.episode ? Number(req.query.episode) : null;

  if (!tmdbId || !type) {
    return res.status(400).json({ error: "tmdbId and type required" });
  }

  const mediaType = type === "tv" || type === "series" ? ("SERIES" as const) : ("MOVIE" as const);

  try {
    const locks = await prisma.lockedContent.findMany({
      where: { tmdbId, type: mediaType },
    });

    // TV + season provided, episode omitted → return all locks for that season
    if (mediaType === "SERIES" && season != null && episode == null) {
      const episodes: Record<number, { reason?: string }> = {};
      let wholeSeason: { reason?: string } | null = null;
      let wholeShow: { reason?: string } | null = null;

      for (const lock of locks) {
        if (lock.season == null && lock.episode == null) {
          wholeShow = { reason: lock.reason ?? undefined };
        } else if (lock.season === season && lock.episode == null) {
          wholeSeason = { reason: lock.reason ?? undefined };
        } else if (lock.season === season && lock.episode != null) {
          episodes[lock.episode] = { reason: lock.reason ?? undefined };
        }
      }

      return res.json({ episodes, wholeSeason, wholeShow });
    }

    // Single item check (movie or specific episode)
    for (const lock of locks) {
      const seasonMatch = lock.season == null || lock.season === season;
      const episodeMatch = lock.episode == null || lock.episode === episode;
      if (seasonMatch && episodeMatch) {
        return res.json({ locked: true, reason: lock.reason ?? undefined });
      }
    }
    res.json({ locked: false });
  } catch (err) {
    console.error("Lock check error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: list all locked content
router.get("/locked", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const locks = await prisma.lockedContent.findMany({
      orderBy: [{ tmdbId: "asc" }, { type: "asc" }, { season: "asc" }, { episode: "asc" }],
    });
    res.json(locks);
  } catch (err) {
    console.error("List locks error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: lock content
router.post("/locked", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  const { tmdbId, type, season, episode, reason } = req.body;

  if (!tmdbId || !type) {
    return res.status(400).json({ error: "tmdbId and type required" });
  }

  const mediaType = type === "tv" || type === "series" ? ("SERIES" as const) : ("MOVIE" as const);

  try {
    const lock = await prisma.lockedContent.create({
      data: {
        tmdbId: Number(tmdbId),
        type: mediaType,
        season: season != null ? Number(season) : null,
        episode: episode != null ? Number(episode) : null,
        reason: reason ?? null,
      },
    });
    res.status(201).json(lock);
  } catch (err) {
    console.error("Lock create error:", err);
    res.status(500).json({ error: "Failed to lock content" });
  }
});

// Admin: unlock content
router.delete("/locked/:id", authenticateToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    await prisma.lockedContent.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Lock delete error:", err);
    res.status(500).json({ error: "Failed to unlock" });
  }
});

// Admin: 10 most recently updated users (by updatedAt)
router.get("/users/recent", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        isAdmin: true,
        isOwner: true,
        isApproved: true,
        commentBlocked: true,
        createdAt: true,
        updatedAt: true,
        watchProgress: { select: { progress: true } },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });

    res.json(
      users.map((u) => {
        const timeWatchedSeconds = u.watchProgress.reduce((s, p) => s + p.progress, 0);
        const { watchProgress: _wp, ...rest } = u;
        return {
          ...rest,
          displayName: u.username || u.email.split("@")[0],
          updatedAt: u.updatedAt,
          timeWatchedSeconds,
        };
      })
    );
  } catch (err) {
    console.error("Recent users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: search users by email or username (display name)
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  const q = (req.query.q as string)?.trim();
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  if (!q || q.length < 2) {
    return res.status(400).json({ error: "Search query (q) required, min 2 characters" });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        isAdmin: true,
        isOwner: true,
        isApproved: true,
        commentBlocked: true,
        createdAt: true,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.username || u.email.split("@")[0],
        username: u.username,
        avatar: u.avatar,
        isAdmin: u.isAdmin,
        isOwner: u.isOwner,
        isApproved: u.isApproved,
        commentBlocked: u.commentBlocked,
        createdAt: u.createdAt,
      }))
    );
  } catch (err) {
    console.error("User search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// One-time promote: set user as admin (requires ADMIN_PROMOTE_SECRET in env)
router.post("/promote", async (req, res) => {
  const secret = process.env.ADMIN_PROMOTE_SECRET;
  if (!secret) return res.status(404).json({ error: "Not configured" });
  const { email, key } = req.body;
  if (!email || key !== secret) return res.status(400).json({ error: "Invalid request" });
  try {
    const user = await prisma.user.update({
      where: { email: String(email).trim() },
      data: { isAdmin: true, isApproved: true },
    });
    res.json({ message: "User promoted to admin", email: user.email });
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});

// Owner: promote user to admin
router.post("/users/:id/promote", authenticateToken, requireOwner, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.userId) return res.status(400).json({ error: "Cannot promote yourself" });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner) return res.status(400).json({ error: "Cannot modify owner" });
    await prisma.user.update({ where: { id: targetId }, data: { isAdmin: true, isApproved: true } });
    res.json({ success: true, message: "User promoted to admin" });
  } catch (err) {
    console.error("Promote error:", err);
    res.status(500).json({ error: "Failed to promote" });
  }
});

// Owner: demote user from admin
router.post("/users/:id/demote", authenticateToken, requireOwner, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.userId) return res.status(400).json({ error: "Cannot demote yourself" });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner) return res.status(400).json({ error: "Cannot modify owner" });
    await prisma.user.update({ where: { id: targetId }, data: { isAdmin: false } });
    res.json({ success: true, message: "User demoted from admin" });
  } catch (err) {
    console.error("Demote error:", err);
    res.status(500).json({ error: "Failed to demote" });
  }
});

// Admin: approve user (allow them to watch content)
router.post("/users/:id/approve", authenticateToken, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner) return res.status(400).json({ error: "Cannot modify owner" });
    await prisma.user.update({ where: { id: targetId }, data: { isApproved: true } });
    res.json({ success: true, message: "User approved" });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Failed to approve user" });
  }
});

// Admin: reject/unapprove user (revoke watch access)
router.post("/users/:id/reject", authenticateToken, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner) return res.status(400).json({ error: "Cannot modify owner" });
    if (target.isAdmin) return res.status(400).json({ error: "Cannot reject admin" });
    await prisma.user.update({ where: { id: targetId }, data: { isApproved: false } });
    res.json({ success: true, message: "User access revoked" });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

// Admin: block user from commenting
router.post("/users/:id/block-comments", authenticateToken, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.userId) return res.status(400).json({ error: "Cannot block yourself" });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner) return res.status(400).json({ error: "Cannot block owner" });
    await prisma.user.update({ where: { id: targetId }, data: { commentBlocked: true } });
    res.json({ success: true, message: "User blocked from commenting" });
  } catch (err) {
    console.error("Block comments error:", err);
    res.status(500).json({ error: "Failed to block" });
  }
});

// Admin: unblock user from commenting
router.post("/users/:id/unblock-comments", authenticateToken, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  try {
    await prisma.user.update({ where: { id: targetId }, data: { commentBlocked: false } });
    res.json({ success: true, message: "User unblocked from commenting" });
  } catch (err) {
    console.error("Unblock comments error:", err);
    res.status(500).json({ error: "Failed to unblock" });
  }
});

// Admin: get user's comments
router.get("/users/:id/comments", authenticateToken, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  try {
    const comments = await prisma.comment.findMany({
      where: { userId: targetId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(comments);
  } catch (err) {
    console.error("User comments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Owner: delete user account
router.delete("/users/:id", authenticateToken, requireOwner, async (req, res) => {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.userId) return res.status(400).json({ error: "Cannot delete yourself" });
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner) return res.status(400).json({ error: "Cannot delete owner" });
    await prisma.user.delete({ where: { id: targetId } });
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Admin: get current user's admin/owner status (for dashboard access)
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, username: true, isAdmin: true, isOwner: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.username || user.email.split("@")[0],
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
      },
    });
  } catch (err) {
    console.error("Admin me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
