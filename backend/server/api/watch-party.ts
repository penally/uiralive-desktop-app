import "dotenv/config";
import express, { Response } from 'express';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { optionalAuth, OptionalAuthRequest } from '../middleware/optionalAuth.js';

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  removeParticipant,
  updatePlayback,
  setCanSkip,
  canUserSkip,
} from '../watch-party/store.js';
import { broadcastParticipantsUpdate } from '../watch-party/broadcast.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

function getGuestDisplayName(): string {
  return `Guest ${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizeGuestDisplayName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return getGuestDisplayName();
  const trimmed = name.trim().slice(0, 32);
  if (!trimmed) return getGuestDisplayName();
  if (profanityMatcher.hasMatch(trimmed)) return getGuestDisplayName();
  return trimmed;
}

// POST /watch-party/create — create a room, returns 4-char code
router.post('/create', optionalAuth, async (req: OptionalAuthRequest, res: Response) => {
  const { serverId, tmdbId, season, episode, displayName: guestDisplayName, guestUserId, allowOffensiveWords } = req.body;

  if (!serverId || !tmdbId) {
    return res.status(400).json({ error: 'serverId and tmdbId required' });
  }

  let displayName = getGuestDisplayName();
  let avatar: string | null = null;
  let userId: string;

  if (req.userId) {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { username: true, email: true, avatar: true },
    });
    if (user) {
      displayName = user.username || user.email?.split('@')[0] || displayName;
      avatar = user.avatar;
    }
    userId = `user_${req.userId}`;
  } else {
    userId = (typeof guestUserId === 'string' && guestUserId.startsWith('anon_') && guestUserId.length <= 24)
      ? guestUserId
      : `anon_${Math.random().toString(36).slice(2, 12)}`;
    displayName = sanitizeGuestDisplayName(guestDisplayName);
  }

  const room = createRoom({
    hostId: userId,
    displayName,
    avatar,
    serverId: String(serverId),
    tmdbId: Number(tmdbId),
    season: season != null ? Number(season) : undefined,
    episode: episode != null ? Number(episode) : undefined,
    allowOffensiveWords: !!allowOffensiveWords,
  });

  res.json({
    code: room.code,
    roomId: room.code,
    hostId: userId,
    displayName,
    avatar,
  });
});

// POST /watch-party/join — join by 4-char code
router.post('/join', optionalAuth, async (req: OptionalAuthRequest, res: Response) => {
  const { code, serverId, displayName: guestDisplayName, guestUserId } = req.body;

  if (!code || typeof code !== 'string' || code.length !== 4) {
    return res.status(400).json({ error: 'Valid 4-character code required' });
  }

  if (!serverId) {
    return res.status(400).json({ error: 'serverId required' });
  }

  let displayName = getGuestDisplayName();
  let avatar: string | null = null;
  let userId: string;

  if (req.userId) {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { username: true, email: true, avatar: true },
    });
    if (user) {
      displayName = user.username || user.email?.split('@')[0] || displayName;
      avatar = user.avatar;
    }
    userId = `user_${req.userId}`;
  } else {
    userId = (typeof guestUserId === 'string' && guestUserId.startsWith('anon_') && guestUserId.length <= 24)
      ? guestUserId
      : `anon_${Math.random().toString(36).slice(2, 12)}`;
    displayName = sanitizeGuestDisplayName(guestDisplayName);
  }

  const result = joinRoom(code.toUpperCase(), {
    userId,
    displayName,
    avatar,
    serverId: String(serverId),
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  const room = result.room;
  const participants = Array.from(room.participants.values()).map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    avatar: p.avatar,
    isHost: p.isHost,
    canSkip: p.canSkip,
  }));

  res.json({
    room: {
      code: room.code,
      hostId: room.hostId,
      serverId: room.serverId,
      tmdbId: room.tmdbId,
      season: room.season,
      episode: room.episode,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      participants,
    },
    userId,
    displayName,
    avatar,
  });
});

// GET /watch-party/room/:code — get room info
router.get('/room/:code', optionalAuth, (req: OptionalAuthRequest, res: Response) => {
  const room = getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const participants = Array.from(room.participants.values()).map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    avatar: p.avatar,
    isHost: p.isHost,
    canSkip: p.canSkip,
  }));
  res.json({
    room: {
      code: room.code,
      hostId: room.hostId,
      serverId: room.serverId,
      tmdbId: room.tmdbId,
      season: room.season,
      episode: room.episode,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      participants,
    },
  });
});

// POST /watch-party/leave — leave room
router.post('/leave', (req, res: Response) => {
  const { code, userId } = req.body;
  if (!code || !userId) {
    return res.status(400).json({ error: 'code and userId required' });
  }
  leaveRoom(code, userId);
  res.json({ ok: true });
});

// POST /watch-party/sync — host syncs playback state (legacy, WebSocket preferred)
router.post('/sync', (req, res: Response) => {
  const { roomId, code, userId, isPlaying, currentTime } = req.body;
  const c = code || roomId;
  if (!c || !userId) {
    return res.status(400).json({ error: 'code/roomId and userId required' });
  }
  const ok = updatePlayback(c, !!isPlaying, Number(currentTime) || 0);
  if (!ok) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const room = getRoom(c);
  res.json({
    room: room
      ? {
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          hostId: room.hostId,
        }
      : null,
  });
});

// GET /watch-party/sync — guests poll for state (legacy, WebSocket preferred)
router.get('/sync', (req, res: Response) => {
  const code = req.query.roomId as string;
  if (!code) {
    return res.status(400).json({ error: 'roomId required' });
  }
  const room = getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    room: {
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      hostId: room.hostId,
    },
  });
});

// POST /watch-party/remove — host removes (kicks) a participant
router.post('/remove', (req, res: Response) => {
  const { code, hostId, targetUserId } = req.body;
  if (!code || !hostId || !targetUserId) {
    return res.status(400).json({ error: 'code, hostId, targetUserId required' });
  }
  const ok = removeParticipant(code, hostId, targetUserId);
  if (!ok) {
    return res.status(403).json({ error: 'Forbidden or room not found' });
  }
  broadcastParticipantsUpdate(code);
  res.json({ ok: true });
});

// POST /watch-party/grant-skip — host grants/revokes skip permission (play/pause + seek)
router.post('/grant-skip', (req, res: Response) => {
  const { code, hostId, targetUserId, canSkip } = req.body;
  if (!code || !hostId || !targetUserId || typeof canSkip !== 'boolean') {
    return res.status(400).json({ error: 'code, hostId, targetUserId, canSkip required' });
  }
  const ok = setCanSkip(code, hostId, targetUserId, canSkip);
  if (!ok) {
    return res.status(403).json({ error: 'Forbidden or room not found' });
  }
  broadcastParticipantsUpdate(code);
  res.json({ ok: true });
});

export default router;
