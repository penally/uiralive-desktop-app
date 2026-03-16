#!/usr/bin/env node
/**
 * Generates LEASE_PROOF_SECRET and VITE_X14 for server-side WASM lease.
 * Run from project root. Output: env lines for backend and frontend.
 */
import crypto from 'crypto';

const proof = crypto.randomBytes(32).toString('hex');
const proofB64 = Buffer.from(proof, 'hex').toString('base64');

console.log('# Backend .env:');
console.log(`LEASE_PROOF_SECRET=${proof}`);
console.log('');
console.log('# Frontend .env:');
console.log(`VITE_X14=${proofB64}`);
