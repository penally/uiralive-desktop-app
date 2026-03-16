#!/usr/bin/env node
/**
 * Encrypts release.wasm with double AES-256-GCM (inner + outer keys).
 * Format: [8B expiry] [12B iv2] [outer_ct incl tag2] where outer_ct = encrypt(inner)
 * Inner format: [12B iv1][inner_ct][16B tag1]
 * Reads keys from backend .env (split parts) or frontend .env (legacy WASM_ENCRYPT_KEY).
 */
import { config } from 'dotenv';
import { createCipheriv, randomBytes } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

config({ path: join(__dirname, '../.env') });
config({ path: join(root, 'backend', '.env') });

function assembleKey(prefix) {
  const p1 = process.env[`${prefix}_P1`];
  const p2 = process.env[`${prefix}_P2`];
  const p3 = process.env[`${prefix}_P3`];
  const p4 = process.env[`${prefix}_P4`];
  if (p1 && p2 && p3 && p4) {
    const hex = (p1 + p2 + p3 + p4).replace(/\s/g, '');
    if (hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)) return Buffer.from(hex, 'hex');
  }
  const full = process.env[prefix]?.replace(/\s/g, '');
  if (full && full.length === 64 && /^[0-9a-fA-F]+$/.test(full)) return Buffer.from(full, 'hex');
  return null;
}

const KEY1 = assembleKey('WASM_ENCRYPT_KEY');
const KEY2 = assembleKey('WASM_ENCRYPT_KEY_2');

if (!KEY1 || KEY1.length !== 32) {
  console.log('Skipping WASM encryption (set WASM_ENCRYPT_KEY or WASM_ENCRYPT_KEY_P1..P4 in backend .env)');
  process.exit(0);
}

const EXPIRY_DAYS = parseInt(process.env.WASM_EXPIRY_DAYS || '90', 10);
const expiryMs = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;

const wasmPath = join(__dirname, '../servers-wasm/build/release.wasm');
const outPath = join(__dirname, '../servers-wasm/build/release.wasm.enc');

const wasm = await import('fs').then(fs => fs.promises.readFile(wasmPath));

const iv1 = randomBytes(12);
const cipher1 = createCipheriv('aes-256-gcm', KEY1, iv1);
const innerCt = Buffer.concat([cipher1.update(wasm), cipher1.final()]);
const tag1 = cipher1.getAuthTag();
const inner = Buffer.concat([iv1, innerCt, tag1]);

let out;
if (KEY2 && KEY2.length === 32) {
  const iv2 = randomBytes(12);
  const cipher2 = createCipheriv('aes-256-gcm', KEY2, iv2);
  const outerCt = Buffer.concat([cipher2.update(inner), cipher2.final()]);
  const tag2 = cipher2.getAuthTag();
  const outer = Buffer.concat([iv2, outerCt, tag2]);
  const expiryBuf = Buffer.alloc(8);
  expiryBuf.writeBigUInt64BE(BigInt(expiryMs));
  out = Buffer.concat([expiryBuf, outer]);
} else {
  const expiryBuf = Buffer.alloc(8);
  expiryBuf.writeBigUInt64BE(BigInt(expiryMs));
  out = Buffer.concat([expiryBuf, inner]);
}

await import('fs').then(fs => fs.promises.writeFile(outPath, out));
console.log(`Encrypted WASM: ${outPath} (expires ${new Date(expiryMs).toISOString()})${KEY2 ? ' [double layer]' : ''}`);
