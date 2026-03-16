import { envAt } from '../_env';

/** Reassemble proof from split storage - never stored whole. */
export function getProofB64(): string {
  const a = envAt(14);
  const b = envAt(18);
  if (!a || !b) return '';
  try {
    const bin = atob(a) + atob(b);
    return btoa(bin);
  } catch {
    return '';
  }
}
