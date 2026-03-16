/** Allows API routes to trigger WebSocket broadcasts when room state changes */
let broadcastFn: ((code: string) => void) | null = null;

export function setBroadcastParticipants(fn: (code: string) => void): void {
  broadcastFn = fn;
}

export function broadcastParticipantsUpdate(code: string): void {
  broadcastFn?.(code);
}
