#!/usr/bin/env node
/**
 * Generates lease encryption and proof secrets.
 * Run from project root. Output: env lines for backend and frontend.
 */
import crypto from 'crypto';

const LEASE_RESPONSE_KEY = crypto.randomBytes(32).toString('hex');
const LEASE_PROOF_SECRET = crypto.randomBytes(32).toString('hex');

const keyBuf = Buffer.from(LEASE_RESPONSE_KEY, 'hex');
const p1 = keyBuf.subarray(0, 11).toString('base64');
const p2 = keyBuf.subarray(11, 22).toString('base64');
const p3 = keyBuf.subarray(22, 32).toString('base64');

const proofB64 = Buffer.from(LEASE_PROOF_SECRET, 'hex').toString('base64');

console.log('# Backend .env:');
console.log(`LEASE_RESPONSE_KEY=${LEASE_RESPONSE_KEY}`);
console.log(`LEASE_PROOF_SECRET=${LEASE_PROOF_SECRET}`);
console.log('');
console.log('# Frontend .env (when VITE_WASM_LEASE=true):');
console.log(`VITE_LEASE_KEY_PART1_B64=${p1}`);
console.log(`VITE_LEASE_KEY_PART2_B64=${p2}`);
console.log(`VITE_LEASE_KEY_PART3_B64=${p3}`);
console.log(`VITE_LEASE_PROOF_B64=${proofB64}`);
