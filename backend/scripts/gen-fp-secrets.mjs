#!/usr/bin/env node
// Generates FP_TOKEN_SECRET and SESSION_BINDING_SECRET for the .env file.
import { randomBytes } from 'crypto';

const fpSecret      = randomBytes(32).toString('hex');
const sessionSecret = randomBytes(32).toString('hex');

console.log('Add these to your backend/.env:\n');
console.log(`FP_TOKEN_SECRET=${fpSecret}`);
console.log(`SESSION_BINDING_SECRET=${sessionSecret}`);
