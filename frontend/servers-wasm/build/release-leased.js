/**
 * Server-decrypted WASM loader. Fetches plain WASM from backend (keys never leave server).
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

export async function loadLeasedWasm(wasmUrl) {
  const res = await fetch(wasmUrl);
  if (!res.ok) throw new Error(`WASM fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const module = await WebAssembly.compile(buf);
  return instantiate(module);
}
