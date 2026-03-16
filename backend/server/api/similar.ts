import express, { Request, Response } from "express";
import { requireApproved } from "../middleware/auth.js";

const router = express.Router();

const LIKEWISE_BASE = "https://api3.likewiseapp.net";

// Proxy: GET /similar?tmdbId=&type=movie|tv&locale=en-US

router.get("/", requireApproved, async (req: Request, res: Response) => {
  const tmdbId = req.query.tmdbId ? String(req.query.tmdbId).trim() : "";
  const type = req.query.type as string;
  const locale = (req.query.locale as string) || "en-US";

  if (!tmdbId || !type) {
    return res.status(400).json({ error: "tmdbId and type required" });
  }

  const path = type === "tv" || type === "series"
    ? `/api/items/shows/internal/similar/${tmdbId}`
    : `/api/items/movies/internal/similar/${tmdbId}`;

  const url = `${LIKEWISE_BASE}${path}?locale=${encodeURIComponent(locale)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Similar fetch failed" });
    }

    const data = (await response.json()) as { results?: unknown[] };
    res.json(data.results ?? []);
  } catch (err) {
    console.error("Similar proxy error:", err);
    res.status(500).json({ error: "Failed to fetch similar content" });
  }
});

export default router;
