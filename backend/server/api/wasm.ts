import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireApproved } from '../middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const SECRET = process.env.WASM_LEASE_SECRET || 'change-me-in-production';
const LEASE_PROOF_SECRET = process.env.LEASE_PROOF_SECRET;

function assembleKeyFromParts(prefix: string): Buffer | null {
  const p1 = process.env[`${prefix}_P1`];
  const p2 = process.env[`${prefix}_P2`];
  const p3 = process.env[`${prefix}_P3`];
  const p4 = process.env[`${prefix}_P4`];
  if (!p1 || !p2 || !p3 || !p4) return null;
  const hex = (p1 + p2 + p3 + p4).replace(/\s/g, '');
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

const WASM_ENC_FILE = process.env.WASM_FILE_PATH || path.resolve(__dirname, '../../../frontend/servers-wasm/build/release.wasm.enc');
const WASM_PLAIN_FILE = path.resolve(__dirname, '../../../frontend/servers-wasm/build/release.wasm');

const WASM_KEY1 = assembleKeyFromParts('WASM_ENCRYPT_KEY');
const WASM_KEY2 = assembleKeyFromParts('WASM_ENCRYPT_KEY_2');
const LEASE_RESP_KEY1 = assembleKeyFromParts('LEASE_RESPONSE_KEY');
const LEASE_RESP_KEY2 = assembleKeyFromParts('LEASE_RESPONSE_KEY_2');
const LEASE_TTL_MS = 60 * 60 * 1000; // 1 hour
const TS_WINDOW_MS = 3 * 60 * 1000; // 3 min - timestamp must be recent

/** Derive encryption key from multiple sources - harder to extract. */
function deriveLeaseEncKey(ts: string, proofB64: string, salt: string): Buffer {
  const proof = Buffer.from(proofB64, 'base64');
  const msg = Buffer.concat([
    Buffer.from(ts, 'utf8'),
    Buffer.from('\x00', 'utf8'),
    proof,
    Buffer.from(salt, 'utf8'),
  ]);
  if (!LEASE_RESP_KEY1) throw new Error('Lease response key not configured');
  let h = crypto.createHmac('sha256', LEASE_RESP_KEY1).update(msg).digest();
  if (LEASE_RESP_KEY2 && LEASE_RESP_KEY2.length === 32) {
    h = crypto.createHmac('sha256', LEASE_RESP_KEY2).update(h).digest();
  }
  return h.subarray(0, 32);
}

function encryptLeasePayload(payload: object, ts: string, proofB64: string): string {
  const key = deriveLeaseEncKey(ts, proofB64, 'v1:lease:enc');
  const iv = crypto.randomBytes(12);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString('base64url');
}

function getPathSegments(): [string, string] {
  const s1 = process.env.WASM_PATH_SEG1;
  const s2 = process.env.WASM_PATH_SEG2;
  if (s1 && s2) return [s1, s2];
  const h = (x: string) => crypto.createHash('sha256').update(SECRET + x).digest('hex').slice(0, 10);
  return [h('\x01'), h('\x02')];
}

const [SEG1, SEG2] = getPathSegments();

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function createToken(ip: string): string {
  const expiry = Date.now() + LEASE_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('base64url');
  const payload = `${expiry}|${ip}|${nonce}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifyToken(token: string, ip: string): boolean {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return false;
    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const [expiryStr, tokenIp] = payload.split('|');
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) return false;
    if (tokenIp !== ip) return false;
    const expectedSig = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function validateTimestamp(tsStr: string): boolean {
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Date.now();
  return Math.abs(now - ts) <= TS_WINDOW_MS;
}

function validateProofHeader(ts: string, receivedProof: string): boolean {
  if (process.env.LEASE_PROOF_SKIP_DEV === 'true') return true;
  const proof = receivedProof?.trim();
  if (!LEASE_PROOF_SECRET || !proof) return false;
  try {
    const hmac = crypto.createHmac('sha256', Buffer.from(LEASE_PROOF_SECRET, 'hex'));
    hmac.update(ts, 'utf8');
    const expectedBuf = hmac.digest();
    const received = Buffer.from(proof, 'base64');
    if (received.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(received, expectedBuf);
  } catch {
    return false;
  }
}

router.get('/:seg1/:seg2/:ts/lease', requireApproved, (req: Request, res: Response) => {
  const seg1 = String(req.params.seg1 ?? '');
  const seg2 = String(req.params.seg2 ?? '');
  const ts = String(req.params.ts ?? '');
  const proofHeader = (req.headers['x-lease-proof'] as string) ?? '';
  if (seg1 !== SEG1 || seg2 !== SEG2 || !validateTimestamp(ts)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!validateProofHeader(ts, proofHeader)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const token = createToken(ip);
  const payload = { url: `/api/wasm/${token}`, expiresAt: Date.now() + LEASE_TTL_MS };
  res.setHeader('Cache-Control', 'no-store');
  if (LEASE_RESP_KEY1) {
    try {
      const enc = encryptLeasePayload(payload, ts, proofHeader.trim());
      res.json({ enc });
    } catch {
      res.json(payload);
    }
  } else {
    res.json(payload);
  }
});

function decryptWasmEnc(encPath: string): Buffer {
  const data = fs.readFileSync(encPath);
  if (data.length < 8 + 12 + 16) throw new Error('Invalid WASM enc file');
  const expiry = Number(data.readBigUInt64BE(0));
  if (Date.now() > expiry) throw new Error('WASM module expired');
  let payload = data.subarray(8);
  if (WASM_KEY2 && WASM_KEY2.length === 32) {
    const iv2 = payload.subarray(0, 12);
    const ct2 = payload.subarray(12, payload.length - 16);
    const tag2 = payload.subarray(payload.length - 16);
    const decipher2 = crypto.createDecipheriv('aes-256-gcm', WASM_KEY2, iv2);
    decipher2.setAuthTag(tag2);
    payload = Buffer.concat([decipher2.update(ct2), decipher2.final()]);
  }
  const iv1 = payload.subarray(0, 12);
  const ct1 = payload.subarray(12, payload.length - 16);
  const tag1 = payload.subarray(payload.length - 16);
  const decipher1 = crypto.createDecipheriv('aes-256-gcm', WASM_KEY1!, iv1);
  decipher1.setAuthTag(tag1);
  return Buffer.concat([decipher1.update(ct1), decipher1.final()]);
}

router.get('/:token', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const token = String(req.params.token ?? '');
  if (!verifyToken(token, ip)) {
    res.status(403).json({ error: 'Invalid or expired WASM lease' });
    return;
  }
  const useEnc = fs.existsSync(WASM_ENC_FILE) && WASM_KEY1;
  const usePlain = fs.existsSync(WASM_PLAIN_FILE);
  if (!useEnc && !usePlain) {
    res.status(404).json({ error: 'WASM file not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (useEnc) {
      const plain = decryptWasmEnc(WASM_ENC_FILE);
      res.send(plain);
    } else {
      fs.createReadStream(WASM_PLAIN_FILE).pipe(res);
    }
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
