import "dotenv/config";
import express, { Request, Response } from 'express';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

// Helper function to convert TMDB type to Prisma MediaType
function convertToPrismaMediaType(tmdbType: string): 'MOVIE' | 'SERIES' {
  return tmdbType === 'movie' ? 'MOVIE' : 'SERIES';
}

// Get user's watchlist
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId: req.userId },
      include: { media: true },
      orderBy: { addedAt: 'desc' },
    });
    res.json(watchlistItems);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to watchlist
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { tmdbId, type, title, year, posterPath } = req.body;

  if (!tmdbId || !type || !title) {
    return res.status(400).json({ error: 'tmdbId, type, and title are required' });
  }

  try {
    const prismaType = convertToPrismaMediaType(type);
    const yearInt = year ? parseInt(year, 10) : null;
    
    const media = await prisma.media.upsert({
      where: { tmdbId_type: { tmdbId, type: prismaType } },
      update: {
        title,
        year: yearInt,
        posterPath,
      },
      create: {
        tmdbId,
        type: prismaType,
        title,
        year: yearInt,
        posterPath,
      },
    });

    // Check if already in watchlist
    const existing = await prisma.watchlistItem.findUnique({
      where: { userId_mediaId: { userId: req.userId!, mediaId: media.id } },
    });
    if (existing) {
      return res.status(400).json({ error: 'Already in watchlist' });
    }

    const watchlistItem = await prisma.watchlistItem.create({
      data: {
        userId: req.userId!,
        mediaId: media.id,
      },
      include: { media: true },
    });
    res.status(201).json(watchlistItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove from watchlist
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const idString = Array.isArray(id) ? id[0] : id;

  try {
    const watchlistItem = await prisma.watchlistItem.findFirst({
      where: { id: parseInt(idString), userId: req.userId },
    });
    if (!watchlistItem) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    await prisma.watchlistItem.delete({ where: { id: parseInt(idString) } });
    res.json({ message: 'Removed from watchlist' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;