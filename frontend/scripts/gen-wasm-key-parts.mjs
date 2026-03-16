#!/usr/bin/env node
/**
 * Splits VITE_WASM_KEY into 4 parts for chunk distribution.
 * Run from project root. Reads frontend .env for VITE_WASM_KEY or WASM_ENCRYPT_KEY.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');

let key = process.env.VITE_WASM_KEY || process.env.WASM_ENCRYPT_KEY;
if (!key && existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  const m = content.match(/VITE_WASM_KEY=(\S+)/m) || content.match(/WASM_ENCRYPT_KEY=(\S+)/m);
  if (m) key = m[1].trim().replace(/^["']|["']$/g, '');
}

if (!key || key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
  console.error('Need VITE_WASM_KEY or WASM_ENCRYPT_KEY (64 hex chars) in .env');
  process.exit(1);
}

const p1 = key.slice(0, 16);
const p2 = key.slice(16, 32);
const p3 = key.slice(32, 48);
const p4 = key.slice(48, 64);

console.log('# Add to frontend .env (replace VITE_WASM_KEY with these):');
console.log(`VITE_WASM_KEY_P1=${p1}`);
console.log(`VITE_WASM_KEY_P2=${p2}`);
console.log(`VITE_WASM_KEY_P3=${p3}`);
console.log(`VITE_WASM_KEY_P4=${p4}`);
