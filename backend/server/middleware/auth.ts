import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export interface AuthRequest extends Request {
  userId?: number;
  sessionId?: string;
  file?: Express.Multer.File;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });

    req.userId = (decoded as any).userId;
    req.sessionId = (decoded as any).sessionId ?? undefined;
    next();
  });
};

/**
 * Requires valid JWT + approved user (or staff/admin/owner).
 * Use for all content endpoints - only approved accounts can watch/browse.
 */
export const requireApproved = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Login required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number; sessionId?: string };
    const userId = decoded.userId;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const canAccess = user.isApproved || user.isAdmin || user.isOwner;
    if (!canAccess) {
      return res.status(403).json({ error: 'Account pending approval', code: 'PENDING_APPROVAL' });
    }

    req.userId = userId;
    req.sessionId = decoded.sessionId ?? undefined;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};