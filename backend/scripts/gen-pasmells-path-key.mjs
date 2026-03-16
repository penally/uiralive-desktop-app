#!/usr/bin/env node
/**
 * Generates PASMELLS_PATH_KEY_P1..P4 for AES-256 path segment encoding.
 * Run from project root. Output: env lines for backend .env
 */
import crypto from 'crypto';

const key = crypto.randomBytes(32).toString('hex');
const parts = [key.slice(0, 16), key.slice(16, 32), key.slice(32, 48), key.slice(48, 64)];

console.log('# Pasmells path segment encryption (AES-256-GCM)');
console.log('# Run: node backend/scripts/gen-pasmells-path-key.mjs');
console.log('PASMELLS_PATH_KEY_P1=' + parts[0]);
console.log('PASMELLS_PATH_KEY_P2=' + parts[1]);
console.log('PASMELLS_PATH_KEY_P3=' + parts[2]);
console.log('PASMELLS_PATH_KEY_P4=' + parts[3]);
