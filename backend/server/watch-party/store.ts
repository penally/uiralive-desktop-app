/**
 * In-memory watch party room store.
 * Rooms are keyed by 4-char code (case-insensitive).
 */

export interface WatchPartyParticipant {
  userId: string;
  displayName: string;
  avatar: string | null;
  isHost: boolean;
  canSkip: boolean;
  serverId: string;
  joinedAt: number;
}

export interface WatchPartyRoom {
  code: string;
  hostId: string;
  serverId: string;
  tmdbId: number;
  season?: number;
  episode?: number;
  participants: Map<string, WatchPartyParticipant>;
  isPlaying: boolean;
  currentTime: number;
  createdAt: number;
  /** If true, chat messages are not filtered for obscenity */
  allowOffensiveWords?: boolean;
}

const rooms = new Map<string, WatchPartyRoom>();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude 0,O,1,I for readability

export function generateCode(): string {
  let code: string;
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    attempts++;
    if (attempts > 100) throw new Error('Failed to generate unique code');
  } while (rooms.has(code.toUpperCase()));
  return code.toUpperCase();
}

export function createRoom(params: {
  hostId: string;
  displayName: string;
  avatar: string | null;
  serverId: string;
  tmdbId: number;
  season?: number;
  episode?: number;
  allowOffensiveWords?: boolean;
}): WatchPartyRoom {
  const code = generateCode();
  const room: WatchPartyRoom = {
    code,
    hostId: params.hostId,
    serverId: params.serverId,
    tmdbId: params.tmdbId,
    season: params.season,
    episode: params.episode,
    participants: new Map(),
    isPlaying: false,
    currentTime: 0,
    createdAt: Date.now(),
    allowOffensiveWords: !!params.allowOffensiveWords,
  };
  room.participants.set(params.hostId, {
    userId: params.hostId,
    displayName: params.displayName,
    avatar: params.avatar,
    isHost: true,
    canSkip: true,
    serverId: params.serverId,
    joinedAt: Date.now(),
  });
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): WatchPartyRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(
  code: string,
  params: {
    userId: string;
    displayName: string;
    avatar: string | null;
    serverId: string;
  }
): { room: WatchPartyRoom } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.participants.has(params.userId)) {
    return { room };
  }
  if (params.serverId !== room.serverId) {
    return { error: 'You must use the same server as the host to join' };
  }
  room.participants.set(params.userId, {
    userId: params.userId,
    displayName: params.displayName,
    avatar: params.avatar,
    isHost: false,
    canSkip: false,
    serverId: params.serverId,
    joinedAt: Date.now(),
  });
  return { room };
}

export function leaveRoom(code: string, userId: string): void {
  const room = rooms.get(code.toUpperCase());
  if (!room) return;
  room.participants.delete(userId);
  if (room.participants.size === 0) {
    rooms.delete(code.toUpperCase());
    return;
  }
  if (room.hostId === userId) {
    const nextHost = room.participants.values().next().value;
    if (nextHost) {
      room.hostId = nextHost.userId;
      nextHost.isHost = true;
      nextHost.canSkip = true;
    }
  }
}

/** Host removes (kicks) a participant from the room */
export function removeParticipant(code: string, hostId: string, targetUserId: string): boolean {
  const room = rooms.get(code.toUpperCase());
  if (!room || room.hostId !== hostId) return false;
  if (targetUserId === hostId) return false; // cannot remove self as host
  if (!room.participants.has(targetUserId)) return false;
  room.participants.delete(targetUserId);
  return true;
}

export function updatePlayback(code: string, isPlaying: boolean, currentTime: number): boolean {
  const room = rooms.get(code.toUpperCase());
  if (!room) return false;
  room.isPlaying = isPlaying;
  room.currentTime = currentTime;
  return true;
}

export function setCanSkip(code: string, hostId: string, targetUserId: string, canSkip: boolean): boolean {
  const room = rooms.get(code.toUpperCase());
  if (!room || room.hostId !== hostId) return false;
  const participant = room.participants.get(targetUserId);
  if (!participant) return false;
  participant.canSkip = canSkip;
  return true;
}

export function canUserSkip(code: string, userId: string): boolean {
  const room = rooms.get(code.toUpperCase());
  if (!room) return false;
  const participant = room.participants.get(userId);
  return participant?.canSkip ?? false;
}

export function getRoomForBroadcast(code: string): WatchPartyRoom | undefined {
  return rooms.get(code.toUpperCase());
}
