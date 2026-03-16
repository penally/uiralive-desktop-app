/**
 * Server-decrypted WASM loader. Fetches plain WASM from backend (keys never leave server).
 * Sync with build/release.js instantiate() when adding new WASM exports.
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
    buildVidfastMediaUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildVidfastMediaUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildVidfastEncDecUrl(rawData) {
      rawData = __lowerString(rawData) || __notnull();
      return __liftString(exports.buildVidfastEncDecUrl(rawData) >>> 0);
    },
    extractVidfastRawData(pageHtml) {
      pageHtml = __lowerString(pageHtml) || __notnull();
      return __liftString(exports.extractVidfastRawData(pageHtml) >>> 0);
    },
    parseVidfastEncDecResponse(jsonStr) {
      jsonStr = __lowerString(jsonStr) || __notnull();
      return __liftString(exports.parseVidfastEncDecResponse(jsonStr) >>> 0);
    },
    buildVideasySourcesUrl(title, mediaType, year, tmdbId, season, episode) {
      title = __retain(__lowerString(title) || __notnull());
      mediaType = __retain(__lowerString(mediaType) || __notnull());
      year = __lowerString(year) || __notnull();
      try {
        return __liftString(exports.buildVideasySourcesUrl(title, mediaType, year, tmdbId, season, episode) >>> 0);
      } finally {
        __release(title);
        __release(mediaType);
      }
    },
    buildVideasyDecryptUrl() {
      return __liftString(exports.buildVideasyDecryptUrl() >>> 0);
    },
    buildVidlinkEncUrl(tmdbId) {
      return __liftString(exports.buildVidlinkEncUrl(tmdbId) >>> 0);
    },
    buildVidlinkApiUrl(encryptedId, mediaType, season, episode) {
      encryptedId = __retain(__lowerString(encryptedId) || __notnull());
      mediaType = __lowerString(mediaType) || __notnull();
      try {
        return __liftString(exports.buildVidlinkApiUrl(encryptedId, mediaType, season, episode) >>> 0);
      } finally {
        __release(encryptedId);
      }
    },
    extractQualityFromStream(streamData) {
      streamData = __lowerString(streamData) || __notnull();
      return __liftString(exports.extractQualityFromStream(streamData) >>> 0);
    },
    buildVidnestMovieUrl(backendId, tmdbId) {
      backendId = __lowerString(backendId) || __notnull();
      return __liftString(exports.buildVidnestMovieUrl(backendId, tmdbId) >>> 0);
    },
    buildVidnestTvUrl(backendId, tmdbId, season, episode) {
      backendId = __lowerString(backendId) || __notnull();
      return __liftString(exports.buildVidnestTvUrl(backendId, tmdbId, season, episode) >>> 0);
    },
    buildProxyDestinationUrl(destination) {
      destination = __lowerString(destination) || __notnull();
      return __liftString(exports.buildProxyDestinationUrl(destination) >>> 0);
    },
    buildMovieBayProxyUrl(url, headersJson) {
      url = __retain(__lowerString(url) || __notnull());
      headersJson = __lowerString(headersJson) || __notnull();
      try {
        return __liftString(exports.buildMovieBayProxyUrl(url, headersJson) >>> 0);
      } finally {
        __release(url);
      }
    },
    buildFemboxMovieUrl(tmdbId, token) {
      token = __lowerString(token) || __notnull();
      return __liftString(exports.buildFemboxMovieUrl(tmdbId, token) >>> 0);
    },
    buildFemboxTvUrl(tmdbId, season, episode, token, region) {
      token = __retain(__lowerString(token) || __notnull());
      region = __lowerString(region) || __notnull();
      try {
        return __liftString(exports.buildFemboxTvUrl(tmdbId, season, episode, token, region) >>> 0);
      } finally {
        __release(token);
      }
    },
    buildFemboxHlsUrl(tmdbId, mediaType, season, episode, token, region) {
      mediaType = __retain(__lowerString(mediaType) || __notnull());
      token = __retain(__lowerString(token) || __notnull());
      region = __lowerString(region) || __notnull();
      try {
        return __liftString(exports.buildFemboxHlsUrl(tmdbId, mediaType, season, episode, token, region) >>> 0);
      } finally {
        __release(mediaType);
        __release(token);
      }
    },
    buildBcineApiUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildBcineApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildBcineProxyUrl(destination, referer, headersJson) {
      destination = __retain(__lowerString(destination) || __notnull());
      referer = __retain(__lowerString(referer) || __notnull());
      headersJson = __lowerString(headersJson) || __notnull();
      try {
        return __liftString(exports.buildBcineProxyUrl(destination, referer, headersJson) >>> 0);
      } finally {
        __release(destination);
        __release(referer);
      }
    },
    decryptBcineUrl(encryptedUrl) {
      encryptedUrl = __lowerString(encryptedUrl) || __notnull();
      return __liftString(exports.decryptBcineUrl(encryptedUrl) >>> 0);
    },
    buildAuroraApiUrl(name, year, tmdbId, mediaType, season, episode, cacheBuster) {
      name = __retain(__lowerString(name) || __notnull());
      year = __retain(__lowerString(year) || __notnull());
      mediaType = __retain(__lowerString(mediaType) || __notnull());
      cacheBuster = __lowerString(cacheBuster) || __notnull();
      try {
        return __liftString(exports.buildAuroraApiUrl(name, year, tmdbId, mediaType, season, episode, cacheBuster) >>> 0);
      } finally {
        __release(name);
        __release(year);
        __release(mediaType);
      }
    },
    buildAuroraM3u8ProxyUrl(url) {
      url = __lowerString(url) || __notnull();
      return __liftString(exports.buildAuroraM3u8ProxyUrl(url) >>> 0);
    },
    buildDougoilEmbedUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildDougoilEmbedUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildDougoilProxyUrl(targetUrl) {
      targetUrl = __lowerString(targetUrl) || __notnull();
      return __liftString(exports.buildDougoilProxyUrl(targetUrl) >>> 0);
    },
    buildDougoilM3u8ProxyUrl(url) {
      url = __lowerString(url) || __notnull();
      return __liftString(exports.buildDougoilM3u8ProxyUrl(url) >>> 0);
    },
    buildAmriApiUrl(tmdbId, season, episode) {
      return __liftString(exports.buildAmriApiUrl(tmdbId, season, episode) >>> 0);
    },
    buildXPassApiUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildXPassApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildYFlixFindUrl(tmdbId, mediaType) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildYFlixFindUrl(tmdbId, mediaType) >>> 0);
    },
    buildYFlixEncUrl(text) {
      text = __lowerString(text) || __notnull();
      return __liftString(exports.buildYFlixEncUrl(text) >>> 0);
    },
    buildYFlixDecUrl() {
      return __liftString(exports.buildYFlixDecUrl() >>> 0);
    },
    buildYFlixLinksUrl(eid, encId) {
      eid = __retain(__lowerString(eid) || __notnull());
      encId = __lowerString(encId) || __notnull();
      try {
        return __liftString(exports.buildYFlixLinksUrl(eid, encId) >>> 0);
      } finally {
        __release(eid);
      }
    },
    buildYFlixViewUrl(lid, encLid) {
      lid = __retain(__lowerString(lid) || __notnull());
      encLid = __lowerString(encLid) || __notnull();
      try {
        return __liftString(exports.buildYFlixViewUrl(lid, encLid) >>> 0);
      } finally {
        __release(lid);
      }
    },
    buildYFlixMediaUrl(embedUrl) {
      embedUrl = __lowerString(embedUrl) || __notnull();
      return __liftString(exports.buildYFlixMediaUrl(embedUrl) >>> 0);
    },
    buildMovieBoxInitUrl() {
      return __liftString(exports.buildMovieBoxInitUrl() >>> 0);
    },
    buildMovieBoxSearchUrl() {
      return __liftString(exports.buildMovieBoxSearchUrl() >>> 0);
    },
    buildMovieBoxDetailUrl(subjectId) {
      subjectId = __lowerString(subjectId) || __notnull();
      return __liftString(exports.buildMovieBoxDetailUrl(subjectId) >>> 0);
    },
    buildMovieBoxDownloadUrl(subjectId, mediaType, season, episode) {
      subjectId = __retain(__lowerString(subjectId) || __notnull());
      mediaType = __lowerString(mediaType) || __notnull();
      try {
        return __liftString(exports.buildMovieBoxDownloadUrl(subjectId, mediaType, season, episode) >>> 0);
      } finally {
        __release(subjectId);
      }
    },
    buildHexaApiUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildHexaApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildHexaDecUrl() {
      return __liftString(exports.buildHexaDecUrl() >>> 0);
    },
    buildSmashyStreamTokenUrl() {
      return __liftString(exports.buildSmashyStreamTokenUrl() >>> 0);
    },
    buildSmashyStreamPlayerUrl(imdbId, tmdbId, mediaType, season, episode, token, userId) {
      imdbId = __retain(__lowerString(imdbId) || __notnull());
      mediaType = __retain(__lowerString(mediaType) || __notnull());
      token = __retain(__lowerString(token) || __notnull());
      userId = __lowerString(userId) || __notnull();
      try {
        return __liftString(exports.buildSmashyStreamPlayerUrl(imdbId, tmdbId, mediaType, season, episode, token, userId) >>> 0);
      } finally {
        __release(imdbId);
        __release(mediaType);
        __release(token);
      }
    },
    buildSmashyStreamVideoUrl(host, id) {
      host = __retain(__lowerString(host) || __notnull());
      id = __lowerString(id) || __notnull();
      try {
        return __liftString(exports.buildSmashyStreamVideoUrl(host, id) >>> 0);
      } finally {
        __release(host);
      }
    },
    buildSmashyStreamDecUrl() {
      return __liftString(exports.buildSmashyStreamDecUrl() >>> 0);
    },
    buildShowboxShareUrl(movieId, type) {
      movieId = __retain(__lowerString(movieId) || __notnull());
      type = __lowerString(type) || __notnull();
      try {
        return __liftString(exports.buildShowboxShareUrl(movieId, type) >>> 0);
      } finally {
        __release(movieId);
      }
    },
    buildShowboxSearchUrl(keyword) {
      keyword = __lowerString(keyword) || __notnull();
      return __liftString(exports.buildShowboxSearchUrl(keyword) >>> 0);
    },
    buildShowboxMovieDetailUrl(movieUrl) {
      movieUrl = __lowerString(movieUrl) || __notnull();
      return __liftString(exports.buildShowboxMovieDetailUrl(movieUrl) >>> 0);
    },
    buildShowboxFileShareInfoUrl(shareKey) {
      shareKey = __lowerString(shareKey) || __notnull();
      return __liftString(exports.buildShowboxFileShareInfoUrl(shareKey) >>> 0);
    },
    buildShowboxFileShareListUrl(shareKey, parentId) {
      shareKey = __retain(__lowerString(shareKey) || __notnull());
      parentId = __lowerString(parentId) || __notnull();
      try {
        return __liftString(exports.buildShowboxFileShareListUrl(shareKey, parentId) >>> 0);
      } finally {
        __release(shareKey);
      }
    },
    buildShowboxProxyBase() {
      return __liftString(exports.buildShowboxProxyBase() >>> 0);
    },
    buildVxrMovieUrl(id) {
      id = __lowerString(id) || __notnull();
      return __liftString(exports.buildVxrMovieUrl(id) >>> 0);
    },
    buildVxrM3u8ProxyUrl(url) {
      url = __lowerString(url) || __notnull();
      return __liftString(exports.buildVxrM3u8ProxyUrl(url) >>> 0);
    },
    extractVxrOriginalUrl(proxyUrl) {
      proxyUrl = __lowerString(proxyUrl) || __notnull();
      return __liftString(exports.extractVxrOriginalUrl(proxyUrl) >>> 0);
    },
    buildMadPlayCdnUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildMadPlayCdnUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildMadPlayApiUrl(tmdbId, mediaType, season, episode) {
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildMadPlayApiUrl(tmdbId, mediaType, season, episode) >>> 0);
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
