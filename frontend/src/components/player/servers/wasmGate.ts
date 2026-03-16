/**
 * WASM lease gate - when lease mode is on, all servers require successful WASM load.
 * No lease = no sources from any server.
 */
import { loadServersWasm } from './wasmLoader';
import { envAt } from './_env';

let gatePromise: Promise<boolean> | null = null;

/** When lease mode is on, must successfully load WASM. Returns false if lease fails. */
export async function requireWasmGate(): Promise<boolean> {
  const seg1B64 = envAt(15);
  const seg2B64 = envAt(16);
  const useLease = !!seg1B64 && !!seg2B64;
  if (!useLease) return true;
  if (gatePromise) return gatePromise;
  gatePromise = loadServersWasm().then((m) => m !== null);
  return gatePromise;
}
