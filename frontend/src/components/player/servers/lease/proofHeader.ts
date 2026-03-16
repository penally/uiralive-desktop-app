/**
 * Computes X-Lease-Proof header - HMAC(ts, secret).
 * Proof secret loaded in separate chunk.
 */
export async function computeProofHeader(ts: string, secretB64: string): Promise<string> {
  const secret = atob(secretB64 || '');
  const secretBuf = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i++) secretBuf[i] = secret.charCodeAt(i);

  const key = await crypto.subtle.importKey(
    'raw',
    secretBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(ts)
  );

  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
