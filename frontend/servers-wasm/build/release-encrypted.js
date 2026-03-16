/**
 * Encrypted WASM loader - fetches .enc, decrypts with AES-256-GCM, instantiates.
 * Format: [8B expiry] [12B IV] [16B authTag] [ciphertext]
 */

async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.setPrototypeOf({
      abort(message, fileName, lineNumber, columnNumber) {
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
      },
    }, Object.assign(Object.create(globalThis), imports.env || {})),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    buildIcefyUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildIcefyUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    parseIcefyResponse(url, text) {
      url = __retain(__lowerString(url) || __notnull());
      text = __lowerString(text) || __notnull();
      try {
        return __liftString(exports.parseIcefyResponse(url, text) >>> 0);
      } finally {
        __release(url);
      }
    },
    buildVixsrcPageUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildVixsrcPageUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildVixsrcPlaylistUrl(videoId, token, expires) {
      videoId = __retain(__lowerString(videoId) || __notnull());
      token = __retain(__lowerString(token) || __notnull());
      expires = __lowerString(expires) || __notnull();
      try {
        return __liftString(exports.buildVixsrcPlaylistUrl(videoId, token, expires) >>> 0);
      } finally {
        __release(videoId);
        __release(token);
      }
    },
    parseVixsrcScript(scriptContent) {
      scriptContent = __lowerString(scriptContent) || __notnull();
      return __liftString(exports.parseVixsrcScript(scriptContent) >>> 0);
    },
    isAllowedOrigin(origin) {
      origin = __lowerString(origin) || __notnull();
      return exports.isAllowedOrigin(origin) != 0;
    },
  }, exports);
  function __liftString(pointer) {
    if (!pointer) return null;
    const end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1;
    const memoryU16 = new Uint16Array(memory.buffer);
    let start = pointer >>> 1, string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __lowerString(value) {
    if (value == null) return 0;
    const length = value.length;
    const pointer = exports.__new(length << 1, 2) >>> 0;
    const memoryU16 = new Uint16Array(memory.buffer);
    for (let i = 0; i < length; ++i) memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);
    return pointer;
  }
  const refcounts = new Map();
  function __retain(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set(exports.__pin(pointer), 1);
    }
    return pointer;
  }
  function __release(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) exports.__unpin(pointer), refcounts.delete(pointer);
      else if (refcount) refcounts.set(pointer, refcount - 1);
      else throw Error(`invalid refcount for reference ${pointer}`);
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  return adaptedExports;
}

async function decryptAesGcmLayer(data, keyBytes) {
  const iv = data.subarray(0, 12);
  const ct = data.subarray(12, data.length - 16);
  const tag = data.subarray(data.length - 16);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, combined);
}

function hexToBytes(hex) {
  const out = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) out[i >> 1] = parseInt(hex.slice(i, i + 2), 16);
  return out;
}

export async function loadEncryptedWasm(encUrl, keyHex1, keyHex2) {
  const res = await fetch(encUrl);
  if (!res.ok) throw new Error(`WASM fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const data = new Uint8Array(buf);

  const expiry = Number(new DataView(data.buffer).getBigUint64(0, false));
  if (Date.now() > expiry) throw new Error("WASM module expired");

  const payload = data.subarray(8);
  const key1 = hexToBytes(keyHex1);
  let inner;
  if (keyHex2 && keyHex2.length === 64) {
    const key2 = hexToBytes(keyHex2);
    inner = await decryptAesGcmLayer(payload, key2);
  } else {
    inner = payload;
  }
  const decrypted = await decryptAesGcmLayer(new Uint8Array(inner), key1);

  const module = await WebAssembly.compile(decrypted);
  return instantiate(module);
}

export const ENC_URL = typeof import.meta !== "undefined" && import.meta.url
  ? new URL("release.wasm.enc", import.meta.url).href
  : "";
