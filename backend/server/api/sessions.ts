import express, { Response } from 'express';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

// GET /sessions — list all sessions for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId! },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Update lastSeenAt for current session
    if (req.sessionId) {
      await prisma.session.updateMany({
        where: { id: req.sessionId, userId: req.userId! },
        data: { lastSeenAt: new Date() },
      }).catch(() => {/* silent */});
    }

    res.json(sessions.map(s => ({
      id: s.id,
      deviceName: s.deviceName,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent: s.id === req.sessionId,
    })));
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /sessions/:id — revoke a specific session
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const deleted = await prisma.session.deleteMany({
      where: { id, userId: req.userId! },
    });
    if (deleted.count === 0) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// DELETE /sessions — revoke all sessions except current
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.session.deleteMany({
      where: {
        userId: req.userId!,
        ...(req.sessionId ? { NOT: { id: req.sessionId } } : {}),
      },
    });
    res.json({ message: 'All other sessions revoked' });
  } catch (err) {
    console.error('Delete all sessions error:', err);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

export default router;
