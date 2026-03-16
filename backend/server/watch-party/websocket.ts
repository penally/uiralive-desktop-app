import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { RegExpMatcher, TextCensor, englishDataset, englishRecommendedTransformers } from 'obscenity';
import {
  getRoom,
  updatePlayback,
  leaveRoom,
  canUserSkip,
} from './store.js';
import { setBroadcastParticipants } from './broadcast.js';

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
const textCensor = new TextCensor();

function sanitizeChatText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return '';
  const matches = profanityMatcher.getAllMatches(trimmed);
  return matches.length > 0 ? textCensor.applyTo(trimmed, matches) : trimmed;
}

export interface WatchPartyWsMessage {
  type: 'join' | 'leave' | 'sync' | 'playback' | 'participants' | 'grant-skip' | 'chat';
  code?: string;
  userId?: string;
  displayName?: string;
  avatar?: string | null;
  isPlaying?: boolean;
  currentTime?: number;
  targetUserId?: string;
  canSkip?: boolean;
  text?: string;
}

type ExtWebSocket = WebSocket & { userId?: string; code?: string };
const clients = new Map<string, Set<ExtWebSocket>>();

function getCodeFromUrl(url: string): string | null {
  try {
    const u = new URL(url, 'http://localhost');
    const code = u.searchParams.get('code');
    return code && code.length === 4 ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function attachWatchPartyWs(server: import('http').Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url || '';
    if (!url.startsWith('/api/watch-party/ws') && !url.startsWith('/watch-party/ws')) {
      socket.destroy();
      return;
    }

    const code = getCodeFromUrl(url);
    if (!code) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, code);
    });
  });

  wss.on('connection', (ws: ExtWebSocket, request: IncomingMessage, code: string) => {
    ws.code = code;

    if (!clients.has(code)) {
      clients.set(code, new Set());
    }
    clients.get(code)!.add(ws);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WatchPartyWsMessage;
        handleMessage(ws, msg, code);
      } catch {
        // ignore invalid json
      }
    });

    ws.on('close', () => {
      const set = clients.get(code);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(code);
      }
      if (ws.userId) {
        leaveRoom(code, ws.userId);
        broadcastParticipants(code);
      }
    });
  });

  function handleMessage(ws: ExtWebSocket, msg: WatchPartyWsMessage, code: string) {
    const room = getRoom(code);
    if (!room) {
      send(ws, { type: 'leave', code });
      return;
    }

    switch (msg.type) {
      case 'join': {
        ws.userId = msg.userId;
        broadcastParticipants(code);
        send(ws, {
          type: 'playback',
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
        });
        break;
      }
      case 'sync':
      case 'playback': {
        if (msg.userId && canUserSkip(code, msg.userId)) {
          updatePlayback(code, msg.isPlaying ?? false, msg.currentTime ?? 0);
          broadcastToRoom(code, {
            type: 'playback',
            isPlaying: msg.isPlaying,
            currentTime: msg.currentTime,
          });
        }
        break;
      }
      case 'grant-skip': {
        // Handled via HTTP for now; could add here if needed
        break;
      }
      case 'chat': {
        if (!msg.userId || !msg.text) break;
        const participant = room.participants.get(msg.userId);
        if (!participant) break;
        const text = room.allowOffensiveWords
          ? msg.text.trim().slice(0, 500)
          : sanitizeChatText(msg.text);
        if (!text) break;
        broadcastToRoom(code, {
          type: 'chat',
          userId: msg.userId,
          displayName: participant.displayName,
          avatar: participant.avatar,
          text,
          ts: Date.now(),
        });
        break;
      }
      default:
        break;
    }
  }

  function send(ws: ExtWebSocket, data: object) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }

  function broadcastToRoom(code: string, data: object) {
    const set = clients.get(code);
    if (!set) return;
    const payload = JSON.stringify(data);
    set.forEach((ws) => {
      if (ws.readyState === 1) ws.send(payload);
    });
  }

  function broadcastParticipants(code: string) {
    const room = getRoom(code);
    if (!room) return;
    const participants = Array.from(room.participants.values()).map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      avatar: p.avatar,
      isHost: p.isHost,
      canSkip: p.canSkip,
    }));
    broadcastToRoom(code, { type: 'participants', code, participants });
  }

  setBroadcastParticipants(broadcastParticipants);

  return wss;
}
