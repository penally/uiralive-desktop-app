import "dotenv/config";
import express, { Response } from 'express';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

function makeMediaKey(tmdbId: number, type: 'MOVIE' | 'SERIES', season?: number | null, episode?: number | null): string {
  if (type === 'MOVIE') return `${tmdbId}_MOVIE`;
  return `${tmdbId}_SERIES_${season ?? 0}_${episode ?? 0}`;
}

// GET /progress — all watch progress for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.watchProgress.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /progress/:tmdbId?type=movie&season=1&episode=2 — single item
router.get('/:tmdbId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const tmdbId = parseInt(req.params.tmdbId as string);
  const type = (req.query.type as string)?.toUpperCase() === 'MOVIE' ? 'MOVIE' : 'SERIES';
  const season = req.query.season ? parseInt(req.query.season as string) : null;
  const episode = req.query.episode ? parseInt(req.query.episode as string) : null;

  if (isNaN(tmdbId)) return res.status(400).json({ error: 'Invalid tmdbId' });

  try {
    const mediaKey = makeMediaKey(tmdbId, type as 'MOVIE' | 'SERIES', season, episode);
    const item = await prisma.watchProgress.findUnique({
      where: { userId_mediaKey: { userId: req.userId!, mediaKey } },
    });
    res.json(item ?? null);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /progress — upsert watch progress
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const {
    tmdbId, type, season, episode,
    progress, duration,
    title, posterPath, backdropPath, voteAverage,
  } = req.body;

  if (!tmdbId || !type || progress === undefined) {
    return res.status(400).json({ error: 'tmdbId, type, and progress are required' });
  }

  const prismaType: 'MOVIE' | 'SERIES' = String(type).toUpperCase() === 'MOVIE' ? 'MOVIE' : 'SERIES';
  const mediaKey = makeMediaKey(Number(tmdbId), prismaType, season, episode);

  try {
    const item = await prisma.watchProgress.upsert({
      where: { userId_mediaKey: { userId: req.userId!, mediaKey } },
      update: {
        progress: Number(progress),
        duration: Number(duration ?? 0),
        title: title ?? null,
        posterPath: posterPath ?? null,
        backdropPath: backdropPath ?? null,
        voteAverage: voteAverage != null ? Number(voteAverage) : null,
      },
      create: {
        userId: req.userId!,
        mediaKey,
        tmdbId: Number(tmdbId),
        type: prismaType,
        season: season != null ? Number(season) : null,
        episode: episode != null ? Number(episode) : null,
        progress: Number(progress),
        duration: Number(duration ?? 0),
        title: title ?? null,
        posterPath: posterPath ?? null,
        backdropPath: backdropPath ?? null,
        voteAverage: voteAverage != null ? Number(voteAverage) : null,
      },
    });
    res.json(item);
  } catch (err) {
    console.error('[progress] upsert error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /progress/:tmdbId?type=movie&season=1&episode=2 — remove progress
router.delete('/:tmdbId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const tmdbId = parseInt(req.params.tmdbId as string);
  const type = (req.query.type as string)?.toUpperCase() === 'MOVIE' ? 'MOVIE' : 'SERIES';
  const season = req.query.season ? parseInt(req.query.season as string) : null;
  const episode = req.query.episode ? parseInt(req.query.episode as string) : null;

  if (isNaN(tmdbId)) return res.status(400).json({ error: 'Invalid tmdbId' });

  try {
    const mediaKey = makeMediaKey(tmdbId, type as 'MOVIE' | 'SERIES', season, episode);
    await prisma.watchProgress.deleteMany({
      where: { userId: req.userId, mediaKey },
    });
    res.json({ message: 'Progress cleared' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
