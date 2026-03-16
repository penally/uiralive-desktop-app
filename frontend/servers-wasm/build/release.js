async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.setPrototypeOf({
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
    }, Object.assign(Object.create(globalThis), imports.env || {})),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    buildIcefyUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildIcefyUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildIcefyUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    parseIcefyResponse(url, text) {
      // assembly/index/parseIcefyResponse(~lib/string/String, ~lib/string/String) => ~lib/string/String
      url = __retain(__lowerString(url) || __notnull());
      text = __lowerString(text) || __notnull();
      try {
        return __liftString(exports.parseIcefyResponse(url, text) >>> 0);
      } finally {
        __release(url);
      }
    },
    buildVixsrcPageUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildVixsrcPageUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildVixsrcPageUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildVixsrcPlaylistUrl(videoId, token, expires) {
      // assembly/index/buildVixsrcPlaylistUrl(~lib/string/String, ~lib/string/String, ~lib/string/String) => ~lib/string/String
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
      // assembly/index/parseVixsrcScript(~lib/string/String) => ~lib/string/String
      scriptContent = __lowerString(scriptContent) || __notnull();
      return __liftString(exports.parseVixsrcScript(scriptContent) >>> 0);
    },
    isAllowedOrigin(origin) {
      // assembly/index/isAllowedOrigin(~lib/string/String) => bool
      origin = __lowerString(origin) || __notnull();
      return exports.isAllowedOrigin(origin) != 0;
    },
    buildVidfastMediaUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildVidfastMediaUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildVidfastMediaUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildVidfastEncDecUrl(rawData) {
      // assembly/index/buildVidfastEncDecUrl(~lib/string/String) => ~lib/string/String
      rawData = __lowerString(rawData) || __notnull();
      return __liftString(exports.buildVidfastEncDecUrl(rawData) >>> 0);
    },
    extractVidfastRawData(pageHtml) {
      // assembly/index/extractVidfastRawData(~lib/string/String) => ~lib/string/String
      pageHtml = __lowerString(pageHtml) || __notnull();
      return __liftString(exports.extractVidfastRawData(pageHtml) >>> 0);
    },
    parseVidfastEncDecResponse(jsonStr) {
      // assembly/index/parseVidfastEncDecResponse(~lib/string/String) => ~lib/string/String
      jsonStr = __lowerString(jsonStr) || __notnull();
      return __liftString(exports.parseVidfastEncDecResponse(jsonStr) >>> 0);
    },
    buildVideasySourcesUrl(title, mediaType, year, tmdbId, season, episode) {
      // assembly/index/buildVideasySourcesUrl(~lib/string/String, ~lib/string/String, ~lib/string/String, i32, i32, i32) => ~lib/string/String
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
      // assembly/index/buildVideasyDecryptUrl() => ~lib/string/String
      return __liftString(exports.buildVideasyDecryptUrl() >>> 0);
    },
    buildVidlinkEncUrl(tmdbId) {
      // assembly/index/buildVidlinkEncUrl(i32) => ~lib/string/String
      return __liftString(exports.buildVidlinkEncUrl(tmdbId) >>> 0);
    },
    buildVidlinkApiUrl(encryptedId, mediaType, season, episode) {
      // assembly/index/buildVidlinkApiUrl(~lib/string/String, ~lib/string/String, i32, i32) => ~lib/string/String
      encryptedId = __retain(__lowerString(encryptedId) || __notnull());
      mediaType = __lowerString(mediaType) || __notnull();
      try {
        return __liftString(exports.buildVidlinkApiUrl(encryptedId, mediaType, season, episode) >>> 0);
      } finally {
        __release(encryptedId);
      }
    },
    extractQualityFromStream(streamData) {
      // assembly/index/extractQualityFromStream(~lib/string/String) => ~lib/string/String
      streamData = __lowerString(streamData) || __notnull();
      return __liftString(exports.extractQualityFromStream(streamData) >>> 0);
    },
    buildVidnestMovieUrl(backendId, tmdbId) {
      // assembly/index/buildVidnestMovieUrl(~lib/string/String, i32) => ~lib/string/String
      backendId = __lowerString(backendId) || __notnull();
      return __liftString(exports.buildVidnestMovieUrl(backendId, tmdbId) >>> 0);
    },
    buildVidnestTvUrl(backendId, tmdbId, season, episode) {
      // assembly/index/buildVidnestTvUrl(~lib/string/String, i32, i32, i32) => ~lib/string/String
      backendId = __lowerString(backendId) || __notnull();
      return __liftString(exports.buildVidnestTvUrl(backendId, tmdbId, season, episode) >>> 0);
    },
    buildProxyDestinationUrl(destination) {
      // assembly/index/buildProxyDestinationUrl(~lib/string/String) => ~lib/string/String
      destination = __lowerString(destination) || __notnull();
      return __liftString(exports.buildProxyDestinationUrl(destination) >>> 0);
    },
    buildMovieBayProxyUrl(url, headersJson) {
      // assembly/index/buildMovieBayProxyUrl(~lib/string/String, ~lib/string/String) => ~lib/string/String
      url = __retain(__lowerString(url) || __notnull());
      headersJson = __lowerString(headersJson) || __notnull();
      try {
        return __liftString(exports.buildMovieBayProxyUrl(url, headersJson) >>> 0);
      } finally {
        __release(url);
      }
    },
    buildFemboxMovieUrl(tmdbId, token) {
      // assembly/index/buildFemboxMovieUrl(i32, ~lib/string/String) => ~lib/string/String
      token = __lowerString(token) || __notnull();
      return __liftString(exports.buildFemboxMovieUrl(tmdbId, token) >>> 0);
    },
    buildFemboxTvUrl(tmdbId, season, episode, token, region) {
      // assembly/index/buildFemboxTvUrl(i32, i32, i32, ~lib/string/String, ~lib/string/String) => ~lib/string/String
      token = __retain(__lowerString(token) || __notnull());
      region = __lowerString(region) || __notnull();
      try {
        return __liftString(exports.buildFemboxTvUrl(tmdbId, season, episode, token, region) >>> 0);
      } finally {
        __release(token);
      }
    },
    buildFemboxHlsUrl(tmdbId, mediaType, season, episode, token, region) {
      // assembly/index/buildFemboxHlsUrl(i32, ~lib/string/String, i32, i32, ~lib/string/String, ~lib/string/String) => ~lib/string/String
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
      // assembly/index/buildBcineApiUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildBcineApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildBcineProxyUrl(destination, referer, headersJson) {
      // assembly/index/buildBcineProxyUrl(~lib/string/String, ~lib/string/String, ~lib/string/String) => ~lib/string/String
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
      // assembly/index/decryptBcineUrl(~lib/string/String) => ~lib/string/String
      encryptedUrl = __lowerString(encryptedUrl) || __notnull();
      return __liftString(exports.decryptBcineUrl(encryptedUrl) >>> 0);
    },
    buildAuroraApiUrl(name, year, tmdbId, mediaType, season, episode, cacheBuster) {
      // assembly/index/buildAuroraApiUrl(~lib/string/String, ~lib/string/String, i32, ~lib/string/String, i32, i32, ~lib/string/String) => ~lib/string/String
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
      // assembly/index/buildAuroraM3u8ProxyUrl(~lib/string/String) => ~lib/string/String
      url = __lowerString(url) || __notnull();
      return __liftString(exports.buildAuroraM3u8ProxyUrl(url) >>> 0);
    },
    buildDougoilEmbedUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildDougoilEmbedUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildDougoilEmbedUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildDougoilProxyUrl(targetUrl) {
      // assembly/index/buildDougoilProxyUrl(~lib/string/String) => ~lib/string/String
      targetUrl = __lowerString(targetUrl) || __notnull();
      return __liftString(exports.buildDougoilProxyUrl(targetUrl) >>> 0);
    },
    buildDougoilM3u8ProxyUrl(url) {
      // assembly/index/buildDougoilM3u8ProxyUrl(~lib/string/String) => ~lib/string/String
      url = __lowerString(url) || __notnull();
      return __liftString(exports.buildDougoilM3u8ProxyUrl(url) >>> 0);
    },
    buildAmriApiUrl(tmdbId, season, episode) {
      // assembly/index/buildAmriApiUrl(i32, i32, i32) => ~lib/string/String
      return __liftString(exports.buildAmriApiUrl(tmdbId, season, episode) >>> 0);
    },
    buildXPassApiUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildXPassApiUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildXPassApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildYFlixFindUrl(tmdbId, mediaType) {
      // assembly/index/buildYFlixFindUrl(i32, ~lib/string/String) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildYFlixFindUrl(tmdbId, mediaType) >>> 0);
    },
    buildYFlixEncUrl(text) {
      // assembly/index/buildYFlixEncUrl(~lib/string/String) => ~lib/string/String
      text = __lowerString(text) || __notnull();
      return __liftString(exports.buildYFlixEncUrl(text) >>> 0);
    },
    buildYFlixDecUrl() {
      // assembly/index/buildYFlixDecUrl() => ~lib/string/String
      return __liftString(exports.buildYFlixDecUrl() >>> 0);
    },
    buildYFlixLinksUrl(eid, encId) {
      // assembly/index/buildYFlixLinksUrl(~lib/string/String, ~lib/string/String) => ~lib/string/String
      eid = __retain(__lowerString(eid) || __notnull());
      encId = __lowerString(encId) || __notnull();
      try {
        return __liftString(exports.buildYFlixLinksUrl(eid, encId) >>> 0);
      } finally {
        __release(eid);
      }
    },
    buildYFlixViewUrl(lid, encLid) {
      // assembly/index/buildYFlixViewUrl(~lib/string/String, ~lib/string/String) => ~lib/string/String
      lid = __retain(__lowerString(lid) || __notnull());
      encLid = __lowerString(encLid) || __notnull();
      try {
        return __liftString(exports.buildYFlixViewUrl(lid, encLid) >>> 0);
      } finally {
        __release(lid);
      }
    },
    buildYFlixMediaUrl(embedUrl) {
      // assembly/index/buildYFlixMediaUrl(~lib/string/String) => ~lib/string/String
      embedUrl = __lowerString(embedUrl) || __notnull();
      return __liftString(exports.buildYFlixMediaUrl(embedUrl) >>> 0);
    },
    buildMovieBoxInitUrl() {
      // assembly/index/buildMovieBoxInitUrl() => ~lib/string/String
      return __liftString(exports.buildMovieBoxInitUrl() >>> 0);
    },
    buildMovieBoxSearchUrl() {
      // assembly/index/buildMovieBoxSearchUrl() => ~lib/string/String
      return __liftString(exports.buildMovieBoxSearchUrl() >>> 0);
    },
    buildMovieBoxDetailUrl(subjectId) {
      // assembly/index/buildMovieBoxDetailUrl(~lib/string/String) => ~lib/string/String
      subjectId = __lowerString(subjectId) || __notnull();
      return __liftString(exports.buildMovieBoxDetailUrl(subjectId) >>> 0);
    },
    buildMovieBoxDownloadUrl(subjectId, mediaType, season, episode) {
      // assembly/index/buildMovieBoxDownloadUrl(~lib/string/String, ~lib/string/String, i32, i32) => ~lib/string/String
      subjectId = __retain(__lowerString(subjectId) || __notnull());
      mediaType = __lowerString(mediaType) || __notnull();
      try {
        return __liftString(exports.buildMovieBoxDownloadUrl(subjectId, mediaType, season, episode) >>> 0);
      } finally {
        __release(subjectId);
      }
    },
    buildHexaApiUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildHexaApiUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildHexaApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildHexaDecUrl() {
      // assembly/index/buildHexaDecUrl() => ~lib/string/String
      return __liftString(exports.buildHexaDecUrl() >>> 0);
    },
    buildSmashyStreamTokenUrl() {
      // assembly/index/buildSmashyStreamTokenUrl() => ~lib/string/String
      return __liftString(exports.buildSmashyStreamTokenUrl() >>> 0);
    },
    buildSmashyStreamPlayerUrl(imdbId, tmdbId, mediaType, season, episode, token, userId) {
      // assembly/index/buildSmashyStreamPlayerUrl(~lib/string/String, i32, ~lib/string/String, i32, i32, ~lib/string/String, ~lib/string/String) => ~lib/string/String
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
      // assembly/index/buildSmashyStreamVideoUrl(~lib/string/String, ~lib/string/String) => ~lib/string/String
      host = __retain(__lowerString(host) || __notnull());
      id = __lowerString(id) || __notnull();
      try {
        return __liftString(exports.buildSmashyStreamVideoUrl(host, id) >>> 0);
      } finally {
        __release(host);
      }
    },
    buildSmashyStreamDecUrl() {
      // assembly/index/buildSmashyStreamDecUrl() => ~lib/string/String
      return __liftString(exports.buildSmashyStreamDecUrl() >>> 0);
    },
    buildShowboxShareUrl(movieId, type) {
      // assembly/index/buildShowboxShareUrl(~lib/string/String, ~lib/string/String) => ~lib/string/String
      movieId = __retain(__lowerString(movieId) || __notnull());
      type = __lowerString(type) || __notnull();
      try {
        return __liftString(exports.buildShowboxShareUrl(movieId, type) >>> 0);
      } finally {
        __release(movieId);
      }
    },
    buildShowboxSearchUrl(keyword) {
      // assembly/index/buildShowboxSearchUrl(~lib/string/String) => ~lib/string/String
      keyword = __lowerString(keyword) || __notnull();
      return __liftString(exports.buildShowboxSearchUrl(keyword) >>> 0);
    },
    buildShowboxMovieDetailUrl(movieUrl) {
      // assembly/index/buildShowboxMovieDetailUrl(~lib/string/String) => ~lib/string/String
      movieUrl = __lowerString(movieUrl) || __notnull();
      return __liftString(exports.buildShowboxMovieDetailUrl(movieUrl) >>> 0);
    },
    buildShowboxFileShareInfoUrl(shareKey) {
      // assembly/index/buildShowboxFileShareInfoUrl(~lib/string/String) => ~lib/string/String
      shareKey = __lowerString(shareKey) || __notnull();
      return __liftString(exports.buildShowboxFileShareInfoUrl(shareKey) >>> 0);
    },
    buildShowboxFileShareListUrl(shareKey, parentId) {
      // assembly/index/buildShowboxFileShareListUrl(~lib/string/String, ~lib/string/String) => ~lib/string/String
      shareKey = __retain(__lowerString(shareKey) || __notnull());
      parentId = __lowerString(parentId) || __notnull();
      try {
        return __liftString(exports.buildShowboxFileShareListUrl(shareKey, parentId) >>> 0);
      } finally {
        __release(shareKey);
      }
    },
    buildShowboxProxyBase() {
      // assembly/index/buildShowboxProxyBase() => ~lib/string/String
      return __liftString(exports.buildShowboxProxyBase() >>> 0);
    },
    buildVxrMovieUrl(id) {
      // assembly/index/buildVxrMovieUrl(~lib/string/String) => ~lib/string/String
      id = __lowerString(id) || __notnull();
      return __liftString(exports.buildVxrMovieUrl(id) >>> 0);
    },
    buildVxrM3u8ProxyUrl(url) {
      // assembly/index/buildVxrM3u8ProxyUrl(~lib/string/String) => ~lib/string/String
      url = __lowerString(url) || __notnull();
      return __liftString(exports.buildVxrM3u8ProxyUrl(url) >>> 0);
    },
    extractVxrOriginalUrl(proxyUrl) {
      // assembly/index/extractVxrOriginalUrl(~lib/string/String) => ~lib/string/String
      proxyUrl = __lowerString(proxyUrl) || __notnull();
      return __liftString(exports.extractVxrOriginalUrl(proxyUrl) >>> 0);
    },
    buildMadPlayCdnUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildMadPlayCdnUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildMadPlayCdnUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
    buildMadPlayApiUrl(tmdbId, mediaType, season, episode) {
      // assembly/index/buildMadPlayApiUrl(i32, ~lib/string/String, i32, i32) => ~lib/string/String
      mediaType = __lowerString(mediaType) || __notnull();
      return __liftString(exports.buildMadPlayApiUrl(tmdbId, mediaType, season, episode) >>> 0);
    },
  }, exports);
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __lowerString(value) {
    if (value == null) return 0;
    const
      length = value.length,
      pointer = exports.__new(length << 1, 2) >>> 0,
      memoryU16 = new Uint16Array(memory.buffer);
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
      else throw Error(`invalid refcount '${refcount}' for reference '${pointer}'`);
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  return adaptedExports;
}
export const {
  memory,
  buildIcefyUrl,
  parseIcefyResponse,
  buildVixsrcPageUrl,
  buildVixsrcPlaylistUrl,
  parseVixsrcScript,
  isAllowedOrigin,
  buildVidfastMediaUrl,
  buildVidfastEncDecUrl,
  extractVidfastRawData,
  parseVidfastEncDecResponse,
  buildVideasySourcesUrl,
  buildVideasyDecryptUrl,
  buildVidlinkEncUrl,
  buildVidlinkApiUrl,
  extractQualityFromStream,
  buildVidnestMovieUrl,
  buildVidnestTvUrl,
  buildProxyDestinationUrl,
  buildMovieBayProxyUrl,
  buildFemboxMovieUrl,
  buildFemboxTvUrl,
  buildFemboxHlsUrl,
  buildBcineApiUrl,
  buildBcineProxyUrl,
  decryptBcineUrl,
  buildAuroraApiUrl,
  buildAuroraM3u8ProxyUrl,
  buildDougoilEmbedUrl,
  buildDougoilProxyUrl,
  buildDougoilM3u8ProxyUrl,
  buildAmriApiUrl,
  buildXPassApiUrl,
  buildYFlixFindUrl,
  buildYFlixEncUrl,
  buildYFlixDecUrl,
  buildYFlixLinksUrl,
  buildYFlixViewUrl,
  buildYFlixMediaUrl,
  buildMovieBoxInitUrl,
  buildMovieBoxSearchUrl,
  buildMovieBoxDetailUrl,
  buildMovieBoxDownloadUrl,
  buildHexaApiUrl,
  buildHexaDecUrl,
  buildSmashyStreamTokenUrl,
  buildSmashyStreamPlayerUrl,
  buildSmashyStreamVideoUrl,
  buildSmashyStreamDecUrl,
  buildShowboxShareUrl,
  buildShowboxSearchUrl,
  buildShowboxMovieDetailUrl,
  buildShowboxFileShareInfoUrl,
  buildShowboxFileShareListUrl,
  buildShowboxProxyBase,
  buildVxrMovieUrl,
  buildVxrM3u8ProxyUrl,
  extractVxrOriginalUrl,
  buildMadPlayCdnUrl,
  buildMadPlayApiUrl,
} = await (async url => instantiate(
  await (async () => {
    const isNodeOrBun = typeof process != "undefined" && process.versions != null && (process.versions.node != null || process.versions.bun != null);
    if (isNodeOrBun) { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
    else { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
  })(), {
  }
))(new URL("release.wasm", import.meta.url));
