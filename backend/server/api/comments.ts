import "dotenv/config";
import express, { Response } from "express";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { PrismaClient } from "../../generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { authenticateToken, requireApproved, AuthRequest } from "../middleware/auth.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
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

// Get comments for a movie/series (requires JWT + approved account)
router.get("/", requireApproved, async (req, res) => {
  const tmdbId = req.query.tmdbId ? Number(req.query.tmdbId) : null;
  const type = req.query.type as string | undefined;

  if (!tmdbId || !type) {
    return res.status(400).json({ error: "tmdbId and type required" });
  }

  const mediaType = type === "tv" || type === "series" ? ("SERIES" as const) : ("MOVIE" as const);

  try {
    const comments = await prisma.comment.findMany({
      where: { tmdbId, type: mediaType },
      include: {
        user: {
          select: { id: true, username: true, email: true, avatar: true, isAdmin: true, isOwner: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          displayName: c.user.username || c.user.email.split("@")[0],
          avatar: c.user.avatar,
          isAdmin: c.user.isAdmin,
          isOwner: c.user.isOwner,
        },
      }))
    );
  } catch (err) {
    console.error("Comments fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Auth: create comment
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  const { tmdbId, type, content } = req.body;

  if (!tmdbId || !type || !content || typeof content !== "string") {
    return res.status(400).json({ error: "tmdbId, type, and content required" });
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) return res.status(400).json({ error: "Comment cannot be empty" });
  if (trimmed.length > 2000) return res.status(400).json({ error: "Comment too long" });
  if (profanityMatcher.hasMatch(trimmed)) {
    return res.status(400).json({ error: "Comment contains inappropriate language" });
  }

  const mediaType = type === "tv" || type === "series" ? ("SERIES" as const) : ("MOVIE" as const);

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.commentBlocked) return res.status(403).json({ error: "You are blocked from commenting" });

    const existing = await prisma.comment.findUnique({
      where: {
        userId_tmdbId_type_season_episode: {
          userId: req.userId!,
          tmdbId: Number(tmdbId),
          type: mediaType,
          season: 0,
          episode: 0,
        },
      },
    });
    if (existing) {
      return res.status(400).json({ error: "You have already commented on this. Edit or delete your existing comment." });
    }

    const comment = await prisma.comment.create({
      data: {
        userId: req.userId!,
        tmdbId: Number(tmdbId),
        type: mediaType,
        season: 0,
        episode: 0,
        content: trimmed,
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, avatar: true, isAdmin: true, isOwner: true },
        },
      },
    });

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        displayName: comment.user.username || comment.user.email.split("@")[0],
        avatar: comment.user.avatar,
        isAdmin: comment.user.isAdmin,
        isOwner: comment.user.isOwner,
      },
    });
  } catch (err) {
    console.error("Comment create error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// Auth: delete own comment, or Admin: delete any comment
router.delete("/:id", authenticateToken, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = user?.isAdmin ?? false;
    const isOwner = comment.userId === req.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Cannot delete this comment" });
    }

    await prisma.comment.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Comment delete error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
