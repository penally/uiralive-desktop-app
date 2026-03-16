import "dotenv/config";
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { balooPowChallengeCache, POW_CHALLENGE_TTL_MS } from '../shared/balooPowCache.js';
import { verifySessionBindingToken } from '../shared/fingerprintValidation.js';
import {
  checkIpRateLimit,
  checkEmailRateLimit,
  isDisposableEmail,
  scoreBrowserSignals,
  checkFpIdRegistrationLimit,
  recordFpIdRegistration,
  type BrowserSignals,
} from '../shared/signalValidation.js';
import { PrismaClient } from '../../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'wow';
const PASMELLS_TURNSTILE_SECRET = process.env.PASMELLS_TURNSTILE_SECRET_KEY || '';

async function verifyPasmellsTurnstile(token: string): Promise<boolean> {
  if (!PASMELLS_TURNSTILE_SECRET) {
    console.warn('[Auth] PASMELLS_TURNSTILE_SECRET_KEY not configured');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: PASMELLS_TURNSTILE_SECRET, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error('[Auth] Turnstile verify error:', e);
    return false;
  }
}

function parseDeviceName(userAgent: string): string {
  let browser = 'Browser';
  if (/Firefox\//.test(userAgent)) browser = 'Firefox';
  else if (/Edg\//.test(userAgent)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//.test(userAgent)) browser = 'Chrome';
  else if (/Safari\//.test(userAgent)) browser = 'Safari';

  let os = 'Unknown';
  if (/iPhone|iPad/.test(userAgent)) os = 'iOS';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (/Windows NT/.test(userAgent)) os = 'Windows';
  else if (/Mac OS X/.test(userAgent)) os = 'macOS';
  else if (/Linux/.test(userAgent)) os = 'Linux';

  return `${browser} on ${os}`;
}

// Verify BalooPow proof-of-work.
interface BalooPowPayload {
  solution: string;
  encryptedData: string;
  encryptedChecksum: string;
  sessionToken: string;  // stateless HMAC issued by /api/baloo/create-auth after fp gate
  publicSalt?: string;   // sent by client as fallback if server cache was cleared
  challenge?: string;    // sent by client as fallback if server cache was cleared
}

// Single-use token registry — maps encryptedChecksum → expiry ms.
const usedChecksums = new Map<string, number>();
const CHECKSUM_TTL_MS = 12 * 60 * 1000;

function pruneUsedChecksums() {
  const now = Date.now();
  for (const [key, expiry] of usedChecksums) {
    if (now > expiry) usedChecksums.delete(key);
  }
}

function consumeChecksum(checksum: string): boolean {
  pruneUsedChecksums();
  if (usedChecksums.has(checksum)) {
    console.warn('[Auth] Replay attempt blocked: checksum already used');
    return false;
  }
  usedChecksums.set(checksum, Date.now() + CHECKSUM_TTL_MS);
  return true;
}

/**
 * Validate BalooPow.
 * Returns the device fpId string on success, or false on failure.
 * The fpId is extracted from the authenticated sessionToken so it cannot be forged.
 */
async function validateBalooPow(payload: BalooPowPayload, _ip: string): Promise<string | false> {
  const { solution, encryptedData, encryptedChecksum, sessionToken, publicSalt: clientSalt, challenge: clientChallenge } = payload;
  if (!solution || !encryptedData || !encryptedChecksum) return false;

  try {
    // STEP 0: Verify session binding token (stateless HMAC — no Map lookup needed).
    if (!sessionToken) {
      console.warn('[Auth] validateBalooPow: missing sessionToken');
      return false;
    }
    const sessionResult = verifySessionBindingToken(encryptedData, sessionToken);
    if (!sessionResult.ok) {
      console.warn('[Auth] validateBalooPow: invalid sessionToken for publicKey');
      return false;
    }

    // Burn checksum AFTER sessionToken is confirmed valid — prevents blind replay attacks
    // from consuming checksums without a valid fp-gate token.
    if (!consumeChecksum(encryptedChecksum)) return false;

    // STEP 1: Get publicSalt + challenge from server cache (prevents direct bypass),
    // or fall back to client-supplied values if cache was cleared (e.g. server restart).
    // sessionToken above already proves the challenge was obtained via our gate.
    let publicSalt: string | undefined;
    let challenge: string | undefined;
    const cached = balooPowChallengeCache.get(encryptedData);
    if (cached && Date.now() - cached.fetchedAt < POW_CHALLENGE_TTL_MS) {
      publicSalt = cached.publicSalt;
      challenge  = cached.challenge;
    } else if (clientSalt && clientChallenge) {
      console.log('[Auth] validateBalooPow: cache miss — using client-provided challenge (sessionToken validated)');
      publicSalt = clientSalt;
      challenge  = clientChallenge;
    } else {
      console.warn('[Auth] validateBalooPow: no challenge available (cache empty, no client fallback)');
      return false;
    }

    // STEP 2: Local SHA256 check.
    const challengeHash = crypto.createHash('sha256').update(publicSalt + solution).digest('hex');
    const accessHash    = crypto.createHash('sha256').update(solution + publicSalt).digest('hex');
    const localValid    = challengeHash === challenge && accessHash === encryptedChecksum;
    console.log('[Auth] validateBalooPow:', { localValid, cacheHit: !!cached, challengeMatch: challengeHash === challenge, accessMatch: accessHash === encryptedChecksum });
    if (!localValid) return false;

    // Return the authenticated fpId from the sessionToken.
    return sessionResult.fpId ?? '';
  } catch (e) {
    console.error('[Auth] BalooPow validate error:', e);
    return false;
  }
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const { email, password, balooPow, signals, turnstileToken } = req.body as {
    email: string;
    password: string;
    balooPow?: BalooPowPayload;
    signals?: BrowserSignals;
    turnstileToken?: string;
  };

  // 1. IP rate limit
  if (!checkIpRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' });
  }

  // 2. Turnstile (Pasmells keys)
  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return res.status(400).json({ error: 'Verification required' });
  }
  const turnstileValid = await verifyPasmellsTurnstile(turnstileToken);
  if (!turnstileValid) {
    return res.status(400).json({ error: 'Verification failed' });
  }

  // 3. Email rate limit
  if (!checkEmailRateLimit(email)) {
    return res.status(429).json({ error: 'Too many attempts for this email.' });
  }

  // 4. Disposable email check
  if (isDisposableEmail(email)) {
    return res.status(400).json({ error: 'Please use a real email address.' });
  }

  // 5. Browser signal check
  const signalResult = scoreBrowserSignals(signals);
  if (!signalResult.ok) {
    console.warn('[Auth] register blocked by signals:', signalResult.reason, { ip: ip.slice(0, 15) });
    return res.status(400).json({ error: 'Verification failed' });
  }
  if (signalResult.score > 0) {
    console.log('[Auth] register signal score:', signalResult.score, { ip: ip.slice(0, 15) });
  }

  // 6. BalooPow
  if (!balooPow?.solution || !balooPow?.encryptedChecksum) {
    return res.status(400).json({ error: 'Verification required' });
  }
  const powResult = await validateBalooPow(balooPow, ip);
  if (powResult === false) {
    return res.status(400).json({ error: 'Verification failed' });
  }
  const fpId = powResult;

  // 7. Per-device registration cap (fpId derived from hardware signals in sessionToken).
  // A bot reusing the same hardcoded canvas/audio/GPU values always produces the same
  // fpId and will be blocked after FP_ID_MAX accounts per 24-hour window.
  if (fpId && !checkFpIdRegistrationLimit(fpId)) {
    console.warn('[Auth] register blocked: device registration cap reached', { ip: ip.slice(0, 15) });
    return res.status(429).json({ error: 'Too many accounts created from this device.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceName: parseDeviceName(req.headers['user-agent'] ?? ''),
      },
    });

    // Record the registration against this device fingerprint.
    if (fpId) recordFpIdRegistration(fpId);

    const token = jwt.sign({ userId: user.id, sessionId: session.id }, JWT_SECRET);
    res.status(201).json({
      message: 'User created',
      token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isApproved: user.isApproved || user.isAdmin || user.isOwner,
      },
    });
  } catch (error) {
    res.status(400).json({ error: 'User already exists or invalid data' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const { email, password, balooPow, signals, turnstileToken } = req.body as {
    email: string;
    password: string;
    balooPow?: BalooPowPayload;
    signals?: BrowserSignals;
    turnstileToken?: string;
  };

  // 1. IP rate limit
  if (!checkIpRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' });
  }

  // 2. Turnstile (Pasmells keys)
  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return res.status(400).json({ error: 'Verification required' });
  }
  const turnstileValid = await verifyPasmellsTurnstile(turnstileToken);
  if (!turnstileValid) {
    return res.status(400).json({ error: 'Verification failed' });
  }

  // 3. Browser signal check
  const signalResult = scoreBrowserSignals(signals);
  if (!signalResult.ok) {
    console.warn('[Auth] login blocked by signals:', signalResult.reason, { ip: ip.slice(0, 15) });
    return res.status(400).json({ error: 'Verification failed' });
  }

  // 4. BalooPow
  if (!balooPow?.solution || !balooPow?.encryptedChecksum) {
    return res.status(400).json({ error: 'Verification required' });
  }
  const powResult = await validateBalooPow(balooPow, ip);
  if (powResult === false) {
    return res.status(400).json({ error: 'Verification failed' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceName: parseDeviceName(req.headers['user-agent'] ?? ''),
      },
    });

    const token = jwt.sign({ userId: user.id, sessionId: session.id }, JWT_SECRET);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isApproved: user.isApproved || user.isAdmin || user.isOwner,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Protected route - Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isApproved: user.isApproved || user.isAdmin || user.isOwner,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { username, avatar } = req.body;

  try {
    const updateData: any = {};
    if (username !== undefined) {
      updateData.username = username;
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isApproved: user.isApproved || user.isAdmin || user.isOwner,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
