import "dotenv/config";
import http from 'http';
import express, { Router } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Catch-all error handlers — log the real crash reason instead of silent exit ──
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});
process.on('SIGTERM', () => {
  console.error('[FATAL] received SIGTERM — process killed by OS/container');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.error('[FATAL] received SIGINT');
  process.exit(0);
});
process.on('exit', (code) => {
  console.error('[FATAL] process.exit called with code:', code);
});

import authRoutes from './api/auth.js';
import watchlistRoutes from './api/watchlist.js';
import uploadRoutes from './api/uploads.js';
import progressRoutes from './api/progress.js';
import playerSettingsRoutes from './api/player-settings.js';
import sessionRoutes from './api/sessions.js';
import adminRoutes from './api/admin.js';
import commentRoutes from './api/comments.js';
import similarRoutes from './api/similar.js';
import wasmRoutes from './api/wasm.js';
import pasmellsRoutes from './api/pasmells.js';
import watchPartyRoutes from './api/watch-party.js';
import { attachWatchPartyWs } from './watch-party/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Application = express();

// Reflect request origin to support credentials from the frontend app
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health checks (no prefix)
app.get('/', (_req, res) => res.json({ ok: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// All API routes under /api
const api = Router();
api.use('/auth', authRoutes);
api.use('/admin', adminRoutes);
api.use('/comments', commentRoutes);
api.use('/similar', similarRoutes);
api.use('/watchlist', watchlistRoutes);
api.use('/uploads', uploadRoutes);
api.use('/progress', progressRoutes);
api.use('/player-settings', playerSettingsRoutes);
api.use('/sessions', sessionRoutes);
api.use('/wasm', wasmRoutes);
api.use(pasmellsRoutes); // /baloo/*, /fp/*, /pow/*, /server/*, /pasmells/*
api.use('/watch-party', watchPartyRoutes);
app.use('/api', api);

const PORT: string | number = process.env.PORT || 3001;

const server = http.createServer(app);
attachWatchPartyWs(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});