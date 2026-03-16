import "dotenv/config";
import express, { Response } from 'express';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

// GET /player-settings — get settings for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.playerSettings.findUnique({
      where: { userId: req.userId },
    });
    res.json(settings ?? {});
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /player-settings — upsert player settings
router.put('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const {
    subtitleSize, subtitleColor, subtitleBackground, subtitleBgOpacity,
    subtitleShadow, subtitleBgEnabled, subtitleAutoDetect, subtitleOpacity,
    subtitleFontFamily, subtitleFontWeight, subtitleFontStyle, subtitleTextDecoration,
    subtitleDelay, fixSubtitles, fixCapitalization,
    volume, playbackRate, autoQuality,
  } = req.body;

  const data: Record<string, unknown> = {};
  if (subtitleSize      != null) data.subtitleSize      = Number(subtitleSize);
  if (subtitleColor     != null) data.subtitleColor     = String(subtitleColor);
  if (subtitleBackground!= null) data.subtitleBackground= String(subtitleBackground);
  if (subtitleBgOpacity != null) data.subtitleBgOpacity = Number(subtitleBgOpacity);
  if (subtitleShadow    != null) data.subtitleShadow    = String(subtitleShadow);
  if (subtitleBgEnabled != null) data.subtitleBgEnabled = Boolean(subtitleBgEnabled);
  if (subtitleAutoDetect!= null) data.subtitleAutoDetect= Boolean(subtitleAutoDetect);
  if (subtitleOpacity   != null) data.subtitleOpacity   = Number(subtitleOpacity);
  if (subtitleFontFamily!= null) data.subtitleFontFamily= String(subtitleFontFamily);
  if (subtitleFontWeight!= null) data.subtitleFontWeight= String(subtitleFontWeight);
  if (subtitleFontStyle != null) data.subtitleFontStyle = String(subtitleFontStyle);
  if (subtitleTextDecoration != null) data.subtitleTextDecoration = String(subtitleTextDecoration);
  if (subtitleDelay     != null) data.subtitleDelay     = Number(subtitleDelay);
  if (fixSubtitles      != null) data.fixSubtitles      = Boolean(fixSubtitles);
  if (fixCapitalization != null) data.fixCapitalization = Boolean(fixCapitalization);
  if (volume            != null) data.volume            = Number(volume);
  if (playbackRate      != null) data.playbackRate      = Number(playbackRate);
  if (autoQuality       != null) data.autoQuality       = Boolean(autoQuality);

  try {
    const settings = await prisma.playerSettings.upsert({
      where: { userId: req.userId! },
      update: data as any,
      create: { userId: req.userId!, ...data } as any,
    });
    res.json(settings);
  } catch (err) {
    console.error('[player-settings] upsert error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
