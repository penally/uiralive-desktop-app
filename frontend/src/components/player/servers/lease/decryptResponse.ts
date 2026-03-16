/**
 * Decrypts lease response. Keys XOR-encoded with salt from proof secret.
 * Stored parts are not usable without proof - adds extraction barrier.
 */
import { envAt } from '../_env';
import { getProofB64 } from './proofSecret';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

async function deriveSaltFromProof(proofB64: string, label: string): Promise<Uint8Array> {
  const proofBuf = b64ToBytes(proofB64);
  const key = await crypto.subtle.importKey('raw', new Uint8Array(proofBuf), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(label));
  return new Uint8Array(sig).subarray(0, 32);
}

function assembleEncoded(ix: number[]): Uint8Array | null {
  const parts = ix.map((i) => envAt(i)).filter(Boolean);
  if (parts.length !== 3) return null;
  try {
    const a = b64ToBytes(parts[0]);
    const b = b64ToBytes(parts[1]);
    const c = b64ToBytes(parts[2]);
    const out = new Uint8Array(a.length + b.length + c.length);
    out.set(a, 0);
    out.set(b, a.length);
    out.set(c, a.length + b.length);
    return out;
  } catch {
    return null;
  }
}

async function assembleKey1(): Promise<Uint8Array | null> {
  const proofB64 = getProofB64();
  if (!proofB64) return null;
  const enc = assembleEncoded([10, 8, 9]); // shuffled storage order
  if (!enc || enc.length !== 32) return null;
  const salt = await deriveSaltFromProof(proofB64, String.fromCharCode(107, 49)); // "k1"
  return xor(enc, salt);
}

async function assembleKey2(): Promise<Uint8Array | null> {
  const proofB64 = getProofB64();
  if (!proofB64) return null;
  const enc = assembleEncoded([13, 11, 12]); // shuffled storage order
  if (!enc || enc.length !== 32) return null;
  const salt = await deriveSaltFromProof(proofB64, String.fromCharCode(107, 50)); // "k2"
  return xor(enc, salt);
}

async function deriveKey(ts: string, proofB64: string): Promise<CryptoKey> {
  const key1 = await assembleKey1();
  if (!key1 || key1.length !== 32) throw new Error('Lease key not configured');

  const proof = Uint8Array.from(atob(proofB64), (c) => c.charCodeAt(0));
  const salt = String.fromCharCode(118, 49, 58, 108, 101, 97, 115, 101, 58, 101, 110, 99); // derivation constant
  const msg = new Uint8Array(new TextEncoder().encode(ts).length + 1 + proof.length + new TextEncoder().encode(salt).length);
  let o = 0;
  msg.set(new TextEncoder().encode(ts), o);
  o += new TextEncoder().encode(ts).length;
  msg[o++] = 0;
  msg.set(proof, o);
  o += proof.length;
  msg.set(new TextEncoder().encode(salt), o);

  const hmacKey = await crypto.subtle.importKey('raw', new Uint8Array(key1), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const h1 = await crypto.subtle.sign('HMAC', hmacKey, msg);
  let h = new Uint8Array(h1);

  const key2 = await assembleKey2();
  if (key2 && key2.length === 32) {
    const hmacKey2 = await crypto.subtle.importKey('raw', new Uint8Array(key2), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const h2 = await crypto.subtle.sign('HMAC', hmacKey2, h);
    h = new Uint8Array(h2);
  }

  return crypto.subtle.importKey('raw', new Uint8Array(h.subarray(0, 32)), { name: 'AES-GCM' }, false, ['decrypt']);
}

function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function decryptLeaseResponse(
  enc: string,
  ts: string,
  proofB64: string
): Promise<{ url: string; expiresAt: number }> {
  const key = await deriveKey(ts, proofB64);
  const raw = base64UrlDecode(enc);
  if (raw.length < 12 + 16) throw new Error('Invalid lease payload');
  const iv = raw.subarray(0, 12);
  const ct = raw.subarray(12, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = new Uint8Array(ct.length + tag.length);
  ciphertext.set(ct);
  ciphertext.set(tag, ct.length);

  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 }, key, new Uint8Array(ciphertext));
  const json = JSON.parse(new TextDecoder().decode(plain)) as { url: string; expiresAt: number };
  if (!json.url || typeof json.expiresAt !== 'number') throw new Error('Invalid lease payload');
  return json;
}
