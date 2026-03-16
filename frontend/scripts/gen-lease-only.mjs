#!/usr/bin/env node
/**
 * Updates ONLY lease-related secrets (keeps WASM keys intact).
 * Use when you want to rotate lease keys without regenerating everything.
 * Output: add to backend .env and frontend .env (replace existing lease vars).
 */
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function randomHex32() {
  return crypto.randomBytes(32).toString('hex');
}

function splitKeyHex(keyHex) {
  const k = keyHex.replace(/\s/g, '');
  if (k.length !== 64) throw new Error('Key must be 64 hex chars');
  return [k.slice(0, 16), k.slice(16, 32), k.slice(32, 48), k.slice(48, 64)];
}

function splitKeyB64(keyHex, parts = 3) {
  const buf = Buffer.from(keyHex, 'hex');
  const chunk = Math.ceil(buf.length / parts);
  const out = [];
  for (let i = 0; i < parts; i++) {
    out.push(buf.subarray(i * chunk, Math.min((i + 1) * chunk, buf.length)).toString('base64'));
  }
  return out;
}

const LEASE_KEY1 = randomHex32();
const LEASE_KEY2 = randomHex32();
const LEASE_PROOF = randomHex32();

const proofBuf = Buffer.from(LEASE_PROOF, 'hex');
const salt1 = crypto.createHmac('sha256', proofBuf).update('k1').digest().subarray(0, 32);
const salt2 = crypto.createHmac('sha256', proofBuf).update('k2').digest().subarray(0, 32);
const key1Buf = Buffer.from(LEASE_KEY1, 'hex');
const key2Buf = Buffer.from(LEASE_KEY2, 'hex');
const enc1 = Buffer.alloc(32);
const enc2 = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  enc1[i] = key1Buf[i] ^ salt1[i];
  enc2[i] = key2Buf[i] ^ salt2[i];
}
const lk1 = splitKeyB64(enc1.toString('hex'));
const lk2 = splitKeyB64(enc2.toString('hex'));

const lk1h = splitKeyHex(LEASE_KEY1);
const lk2h = splitKeyHex(LEASE_KEY2);

console.log('# ========== BACKEND .env (lease only - replace LEASE_* vars) ==========');
console.log('LEASE_RESPONSE_KEY_P1=' + lk1h[0]);
console.log('LEASE_RESPONSE_KEY_P2=' + lk1h[1]);
console.log('LEASE_RESPONSE_KEY_P3=' + lk1h[2]);
console.log('LEASE_RESPONSE_KEY_P4=' + lk1h[3]);
console.log('LEASE_RESPONSE_KEY_2_P1=' + lk2h[0]);
console.log('LEASE_RESPONSE_KEY_2_P2=' + lk2h[1]);
console.log('LEASE_RESPONSE_KEY_2_P3=' + lk2h[2]);
console.log('LEASE_RESPONSE_KEY_2_P4=' + lk2h[3]);
console.log('LEASE_PROOF_SECRET=' + LEASE_PROOF);
console.log('');
console.log('# ========== FRONTEND .env (replace VITE_X8-X14, add VITE_X18) ==========');
console.log('VITE_X8=' + lk1[1]);
console.log('VITE_X9=' + lk1[2]);
console.log('VITE_X10=' + lk1[0]);
console.log('VITE_X11=' + lk2[1]);
console.log('VITE_X12=' + lk2[2]);
console.log('VITE_X13=' + lk2[0]);
console.log('VITE_X14=' + proofBuf.subarray(0, 16).toString('base64'));
console.log('VITE_X18=' + proofBuf.subarray(16, 32).toString('base64'));
