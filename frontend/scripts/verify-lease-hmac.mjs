#!/usr/bin/env node
/**
 * Verifies HMAC computation matches between Node (backend) and browser (frontend) logic.
 * Run from project root. Reads .env from backend and frontend.
 */
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, 'utf8');
  const out = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const backendEnv = loadEnv(join(root, 'backend', '.env'));
const frontendEnv = loadEnv(join(root, 'frontend', '.env'));

const LEASE_PROOF_SECRET = backendEnv.LEASE_PROOF_SECRET;
const VITE_LEASE_PROOF_B64 = frontendEnv.VITE_LEASE_PROOF_B64;
const ts = String(Date.now());

console.log('Testing with ts:', ts);
console.log('Backend has LEASE_PROOF_SECRET:', !!LEASE_PROOF_SECRET);
console.log('Frontend has VITE_LEASE_PROOF_B64:', !!VITE_LEASE_PROOF_B64);

if (!LEASE_PROOF_SECRET || !VITE_LEASE_PROOF_B64) {
  console.error('Missing env vars. Run gen-lease-secrets.mjs first.');
  process.exit(1);
}

// Backend computation
const backendHmac = crypto.createHmac('sha256', Buffer.from(LEASE_PROOF_SECRET, 'hex'));
backendHmac.update(ts, 'utf8');
const backendSig = backendHmac.digest();
const backendB64 = backendSig.toString('base64');

// Frontend-style: secret from base64, then HMAC
const secretFromB64 = Buffer.from(VITE_LEASE_PROOF_B64, 'base64');
const frontendHmac = crypto.createHmac('sha256', secretFromB64);
frontendHmac.update(ts, 'utf8');
const frontendSig = frontendHmac.digest();
const frontendB64 = frontendSig.toString('base64');

const backendSecret = Buffer.from(LEASE_PROOF_SECRET, 'hex');
console.log('\nBackend secret first 8 bytes:', backendSecret.subarray(0, 8).toString('hex'));
console.log('Frontend secret (from b64) first 8 bytes:', secretFromB64.subarray(0, 8).toString('hex'));
console.log('Secrets match:', backendSecret.equals(secretFromB64) ? 'YES' : 'NO');

console.log('\nBackend HMAC base64:', backendB64);
console.log('Frontend HMAC base64:', frontendB64);
console.log('HMAC results match:', backendB64 === frontendB64 ? 'YES' : 'NO');
