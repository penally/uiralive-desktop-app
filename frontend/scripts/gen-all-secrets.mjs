#!/usr/bin/env node
/**
 * Generates all WASM/lease secrets. Uses opaque env names (VITE_X0..VITE_X16).
 * Run from project root. Output: env lines for backend .env and frontend .env.
 * Index map: X0-X3=wasm k1, X4-X7=wasm k2, X8-X10=lease k1, X11-X13=lease k2, X14=proof, X15-X16=path
 */
import crypto from 'crypto';

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
const WASM_KEY1 = randomHex32();
const WASM_KEY2 = randomHex32();

const wk1 = splitKeyHex(WASM_KEY1);
const wk2 = splitKeyHex(WASM_KEY2);

// XOR-encode lease keys with salt derived from proof - frontend needs proof to decode
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

console.log('# ========== BACKEND .env ==========');
const lk1h = splitKeyHex(LEASE_KEY1);
console.log('LEASE_RESPONSE_KEY_P1=' + lk1h[0]);
console.log('LEASE_RESPONSE_KEY_P2=' + lk1h[1]);
console.log('LEASE_RESPONSE_KEY_P3=' + lk1h[2]);
console.log('LEASE_RESPONSE_KEY_P4=' + lk1h[3]);
const lk2h = splitKeyHex(LEASE_KEY2);
console.log('LEASE_RESPONSE_KEY_2_P1=' + lk2h[0]);
console.log('LEASE_RESPONSE_KEY_2_P2=' + lk2h[1]);
console.log('LEASE_RESPONSE_KEY_2_P3=' + lk2h[2]);
console.log('LEASE_RESPONSE_KEY_2_P4=' + lk2h[3]);
console.log('LEASE_PROOF_SECRET=' + LEASE_PROOF);
console.log('WASM_ENCRYPT_KEY_P1=' + wk1[0]);
console.log('WASM_ENCRYPT_KEY_P2=' + wk1[1]);
console.log('WASM_ENCRYPT_KEY_P3=' + wk1[2]);
console.log('WASM_ENCRYPT_KEY_P4=' + wk1[3]);
console.log('WASM_ENCRYPT_KEY_2_P1=' + wk2[0]);
console.log('WASM_ENCRYPT_KEY_2_P2=' + wk2[1]);
console.log('WASM_ENCRYPT_KEY_2_P3=' + wk2[2]);
console.log('WASM_ENCRYPT_KEY_2_P4=' + wk2[3]);
console.log('');
console.log('# ========== FRONTEND .env (opaque: VITE_X0..X16) ==========');
console.log('# X0-X3=wasm k1, X4-X7=wasm k2, X8-X10=lease k1, X11-X13=lease k2, X14=proof, X15-X16=path');
console.log('VITE_X0=' + wk1[0]);
console.log('VITE_X1=' + wk1[1]);
console.log('VITE_X2=' + wk1[2]);
console.log('VITE_X3=' + wk1[3]);
console.log('VITE_X4=' + wk2[0]);
console.log('VITE_X5=' + wk2[1]);
console.log('VITE_X6=' + wk2[2]);
console.log('VITE_X7=' + wk2[3]);
// Shuffled: key1 parts in 10,8,9; key2 parts in 13,11,12 - non-obvious mapping
console.log('VITE_X8=' + lk1[1]);
console.log('VITE_X9=' + lk1[2]);
console.log('VITE_X10=' + lk1[0]);
console.log('VITE_X11=' + lk2[1]);
console.log('VITE_X12=' + lk2[2]);
console.log('VITE_X13=' + lk2[0]);
// Proof split across two vars - reassemble at runtime
console.log('VITE_X14=' + proofBuf.subarray(0, 16).toString('base64'));
console.log('VITE_X18=' + proofBuf.subarray(16, 32).toString('base64'));
console.log('# X15,X16 from gen-wasm-path.mjs: VITE_X15=pathSeg1B64, VITE_X16=pathSeg2B64');
