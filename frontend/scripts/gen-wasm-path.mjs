#!/usr/bin/env node
/**
 * Generates WASM lease path segments from WASM_LEASE_SECRET.
 * Run from project root with backend .env loaded, or set WASM_LEASE_SECRET.
 * Output: env lines for backend and frontend .env
 */
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const backendEnv = path.join(root, 'backend', '.env');

let secret = process.env.WASM_LEASE_SECRET;
if (!secret && existsSync(backendEnv)) {
  const content = readFileSync(backendEnv, 'utf8');
  const m = content.match(/WASM_LEASE_SECRET=(.+)/m);
  if (m) secret = m[1].trim().replace(/^["']|["']$/g, '');
}
secret = secret || 'change-me-in-production';

const seg1 = crypto.createHash('sha256').update(secret + '\x01').digest('hex').slice(0, 10);
const seg2 = crypto.createHash('sha256').update(secret + '\x02').digest('hex').slice(0, 10);

console.log('# Add these to backend .env:');
console.log(`WASM_PATH_SEG1=${seg1}`);
console.log(`WASM_PATH_SEG2=${seg2}`);
console.log('');
console.log('# Add these to frontend .env (VITE_X15, VITE_X16 for opaque naming):');
console.log(`VITE_X15=${Buffer.from(seg1, 'utf8').toString('base64')}`);
console.log(`VITE_X16=${Buffer.from(seg2, 'utf8').toString('base64')}`);
