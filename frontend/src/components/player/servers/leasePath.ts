/**
 * Obfuscated lease path builder. No plain path segments - built from encoded chunks.
 * This file is obfuscated by the build; structure is scattered to resist scraping.
 */

const _d = (s: string) => atob(s);
const _c = (...n: number[]) => String.fromCharCode(...n);

export interface LeasePathResult {
  path: string;
  ts: string;
}

/** Build the lease endpoint path: /api/wasm/{seg1}/{seg2}/{ts}/lease */
export function buildLeasePath(seg1B64: string, seg2B64: string): LeasePathResult {
  const p1 = _d(seg1B64);
  const p2 = _d(seg2B64);
  const ts = String(Date.now());
  const a = _d(_c(89, 88, 66, 112));       // "YXBp" -> "api"
  const w = _d(_c(100, 50, 70, 122, 98, 81, 61, 61)); // d2FzbQ==
  const l = _d(_c(98, 71, 86, 104, 99, 50, 85, 61));  // bGVhc2U=
  const path = _c(47) + a + _c(47) + w + _c(47) + p1 + _c(47) + p2 + _c(47) + ts + _c(47) + l;
  return { path, ts };
}
