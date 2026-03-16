/**
 * Shared in-memory cache for BalooPow challenge data.
 *
 * When the frontend fetches a challenge via /api/pow/:publicKey (in pasmells.ts),
 * the result is stored here. Auth validation (auth.ts) then reads the same cached
 * data so it validates against exactly what the frontend solved — even if pow-api
 * would return different data on a second fetch.
 */

export interface CachedChallenge {
  publicSalt: string;
  challenge:  string;
  checksum?:  string;
  numeric?:   boolean;
  fetchedAt:  number;
}

export const balooPowChallengeCache = new Map<string, CachedChallenge>();
export const POW_CHALLENGE_TTL_MS = 6 * 60 * 1000; // 6 min
