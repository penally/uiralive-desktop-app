// Server extraction logic compiled to WASM - URLs and parsing in binary form.

/** Build Icefy HLS URL. Logic compiled to WASM. */
export function buildIcefyUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://streams.icefy.top/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString() + "/bump/master.m3u8";
  } else {
    return "https://streams.icefy.top/movie/" + tmdbId.toString() + "/bump/master.m3u8";
  }
}

/** Validate Icefy m3u8 response and return MediaSource JSON or "[]". */
export function parseIcefyResponse(url: string, text: string): string {
  if (text.includes("EXT-X-ERROR") || text.includes("Content not found")) {
    return "[]";
  }
  const trimmed = text.trim();
  if (!trimmed.startsWith("#EXTM3U")) {
    return "[]";
  }
  const escaped = escapeJson(url);
  return "[{\"url\":\"" + escaped + "\",\"quality\":\"Auto\",\"name\":\"Icefy\",\"speed\":\"—\",\"size\":\"—\",\"type\":\"hls\"}]";
}

function escapeJson(s: string): string {
  let result = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const c = s.charAt(i);
    if (c == "\\") {
      result += "\\\\";
    } else if (c == "\"") {
      result += "\\\"";
    } else {
      result += c;
    }
  }
  return result;
}

// --- Redwood (Vixsrc) ---

/** Build Vixsrc page URL. */
export function buildVixsrcPageUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://vixsrc.to/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString();
  } else {
    return "https://vixsrc.to/movie/" + tmdbId.toString();
  }
}

/** Build Vixsrc playlist URL from extracted params. */
export function buildVixsrcPlaylistUrl(videoId: string, token: string, expires: string): string {
  return "https://vixsrc.to/playlist/" + videoId + "?token=" + token + "&expires=" + expires + "&h=1&lang=en";
}

/** Parse Vixsrc script content; returns JSON "{\"videoId\":\"x\",\"token\":\"y\",\"expires\":\"z\"}" or "{}". */
export function parseVixsrcScript(scriptContent: string): string {
  const videoId = extractVixsrcVideoId(scriptContent);
  const token = extractVixsrcToken(scriptContent);
  const expires = extractVixsrcExpires(scriptContent);
  if (videoId == "" || token == "" || expires == "") return "{}";
  const ev = escapeJson(videoId);
  const tv = escapeJson(token);
  const exv = escapeJson(expires);
  return "{\"videoId\":\"" + ev + "\",\"token\":\"" + tv + "\",\"expires\":\"" + exv + "\"}";
}

function extractVixsrcVideoId(s: string): string {
  // window.video = { ... id: "xxx"
  const id1 = s.indexOf("id:");
  if (id1 >= 0) {
    const q1 = s.indexOf('"', id1);
    const q2 = s.indexOf("'", id1);
    const start = (q1 >= 0 && (q2 < 0 || q1 < q2)) ? q1 + 1 : (q2 >= 0 ? q2 + 1 : -1);
    if (start >= 0) {
      const endD = s.indexOf('"', start);
      const endS = s.indexOf("'", start);
      const end = (endD >= 0 && (endS < 0 || endD < endS)) ? endD : endS;
      if (end >= 0) return s.substring(start, end);
    }
  }
  // /playlist/123 in masterPlaylist url
  const pl = s.indexOf("/playlist/");
  if (pl >= 0) {
    const start = pl + 9;
    let end = start;
    const len = s.length;
    while (end < len) {
      const c = s.charAt(end);
      if (c == "?" || c == '"' || c == "'" || c == "/" || c == " ") break;
      end++;
    }
    return s.substring(start, end);
  }
  return "";
}

function extractVixsrcToken(s: string): string {
  return extractAfterKey(s, "token");
}

function extractVixsrcExpires(s: string): string {
  return extractAfterKey(s, "expires");
}

function extractAfterKey(s: string, key: string): string {
  const k1 = s.indexOf('"' + key + '"');
  const k2 = s.indexOf("'" + key + "'");
  const pos = (k1 >= 0 && (k2 < 0 || k1 < k2)) ? k1 : k2;
  if (pos < 0) return "";
  const colon = s.indexOf(":", pos);
  if (colon < 0) return "";
  const q1 = s.indexOf('"', colon);
  const q2 = s.indexOf("'", colon);
  const start = (q1 >= 0 && (q2 < 0 || q1 < q2)) ? q1 + 1 : (q2 >= 0 ? q2 + 1 : -1);
  if (start < 0) return "";
  const endD = s.indexOf('"', start);
  const endS = s.indexOf("'", start);
  const end = (endD >= 0 && (endS < 0 || endD < endS)) ? endD : endS;
  if (end < 0) return "";
  return s.substring(start, end);
}

/** Domain guard - check if origin is allowed. */
export function isAllowedOrigin(origin: string): bool {
  if (origin == "https://uira.live") return true;
  if (origin == "https://www.uira.live") return true;
  if (origin == "https://beta.uira.live") return true;
  if (origin.startsWith("http://localhost")) return true;
  if (origin.startsWith("http://127.0.0.1")) return true;
  return false;
}

// --- Vidfast ---

export function buildVidfastMediaUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://vidfast.pro/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString();
  } else {
    return "https://vidfast.pro/movie/" + tmdbId.toString();
  }
}

export function buildVidfastEncDecUrl(rawData: string): string {
  return "https://enc-dec.app/api/enc-vidfast?text=" + rawData;
}

/** Extract raw data from pageHtml using \\"en\\":\\"(.*?)\\"/ pattern. Returns empty if not found. */
export function extractVidfastRawData(pageHtml: string): string {
  const p1 = pageHtml.indexOf('\\"en\\":\\"');
  if (p1 >= 0) {
    const start = p1 + 9;
    const end = pageHtml.indexOf('\\"', start);
    if (end >= 0) return pageHtml.substring(start, end);
  }
  const p2 = pageHtml.indexOf('"en":"');
  if (p2 >= 0) {
    const start = p2 + 6;
    const end = pageHtml.indexOf('"', start);
    if (end >= 0) return pageHtml.substring(start, end);
  }
  return "";
}

function extractJsonValue(s: string, key: string): string {
  const kq = '"' + key + '"';
  const pos = s.indexOf(kq);
  if (pos < 0) return "";
  const colon = s.indexOf(":", pos);
  if (colon < 0) return "";
  const q1 = s.indexOf('"', colon);
  if (q1 < 0) return "";
  const start = q1 + 1;
  const end = s.indexOf('"', start);
  if (end < 0) return "";
  return s.substring(start, end);
}

/** Parse enc-dec response for servers and stream. Returns JSON "{\"servers\":\"x\",\"stream\":\"y\"}" or "{}". */
export function parseVidfastEncDecResponse(jsonStr: string): string {
  const servers = extractJsonValue(jsonStr, "servers");
  const stream = extractJsonValue(jsonStr, "stream");
  if (servers == "" || stream == "") {
    const result = extractJsonValue(jsonStr, "result");
    if (result != "") {
      const s2 = extractJsonValue(result, "servers");
      const st2 = extractJsonValue(result, "stream");
      if (s2 != "" && st2 != "") {
        return "{\"servers\":\"" + escapeJson(s2) + "\",\"stream\":\"" + escapeJson(st2) + "\"}";
      }
    }
    return "{}";
  }
  return "{\"servers\":\"" + escapeJson(servers) + "\",\"stream\":\"" + escapeJson(stream) + "\"}";
}

// --- Videasy ---

export function buildVideasySourcesUrl(title: string, mediaType: string, year: string, tmdbId: i32, season: i32, episode: i32): string {
  let q = "title=" + encodeUriComponent(title) + "&mediaType=" + mediaType + "&year=" + year + "&tmdbId=" + tmdbId.toString();
  if (mediaType == "show") {
    q = q + "&seasonId=" + season.toString() + "&episodeId=" + episode.toString();
  }
  return "https://api.videasy.net/1movies/sources-with-title?" + q;
}

export function buildVideasyDecryptUrl(): string {
  return "https://enc-dec.app/api/dec-videasy";
}

// --- Vidlink ---

export function buildVidlinkEncUrl(tmdbId: i32): string {
  return "https://enc-dec.app/api/enc-vidlink?text=" + tmdbId.toString();
}

export function buildVidlinkApiUrl(encryptedId: string, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://vidlink.pro/api/b/tv/" + encryptedId + "/" + season.toString() + "/" + episode.toString();
  } else {
    return "https://vidlink.pro/api/b/movie/" + encryptedId;
  }
}

export function extractQualityFromStream(streamData: string): string {
  const lower = streamData.toLowerCase();
  if (lower.includes("2160") || lower.includes("4k")) return "4K";
  if (lower.includes("1440") || lower.includes("2k")) return "1440p";
  if (lower.includes("1080") || lower.includes("fhd")) return "1080p";
  if (lower.includes("720") || lower.includes("hd")) return "720p";
  if (lower.includes("480") || lower.includes("sd")) return "480p";
  if (lower.includes("360")) return "360p";
  if (lower.includes("240")) return "240p";
  return "Auto";
}

// --- Vidnest ---

export function buildVidnestMovieUrl(backendId: string, tmdbId: i32): string {
  const base = getVidnestBase(backendId, "movie");
  return base + "/" + tmdbId.toString();
}

export function buildVidnestTvUrl(backendId: string, tmdbId: i32, season: i32, episode: i32): string {
  const base = getVidnestBase(backendId, "tv");
  return base + "/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString();
}

function getVidnestBase(id: string, type: string): string {
  if (id == "alfa") return type == "movie" ? "https://new.animanga.fun/primesrc/movie" : "https://new.animanga.fun/primesrc/tv";
  if (id == "lamda") return type == "movie" ? "https://one.animanga.fun/allmovies/movie" : "https://one.animanga.fun/allmovies/tv";
  if (id == "sigma") return type == "movie" ? "https://new.animanga.fun/hollymoviehd/movie" : "https://new.animanga.fun/hollymoviehd/tv";
  if (id == "delta") return type == "movie" ? "https://one.animanga.fun/allmovies/movie" : "https://one.animanga.fun/allmovies/tv";
  if (id == "catflix") return type == "movie" ? "https://new.animanga.fun/hollymoviehd/movie" : "https://new.animanga.fun/hollymoviehd/tv";
  if (id == "ophim") return type == "movie" ? "https://new.animanga.fun/ophim/movie" : "https://new.animanga.fun/ophim/tv";
  return "";
}

export function buildProxyDestinationUrl(destination: string): string {
  return "https://proxy.moviebay.cc/?destination=" + encodeUriComponent(destination);
}

export function buildMovieBayProxyUrl(url: string, headersJson: string): string {
  if (headersJson != "") {
    return "https://proxy.moviebay.cc/m3u8-proxy?url=" + encodeUriComponent(url) + "&headers=" + encodeUriComponent(headersJson);
  }
  return "https://proxy.moviebay.cc/m3u8-proxy?url=" + encodeUriComponent(url);
}

// --- Fembox ---

export function buildFemboxMovieUrl(tmdbId: i32, token: string): string {
  return "https://fembox.aether.mom/movie/" + tmdbId.toString() + "?ui=" + token;
}

export function buildFemboxTvUrl(tmdbId: i32, season: i32, episode: i32, token: string, region: string): string {
  let url = "https://fembox.aether.mom/tv/" + tmdbId.toString() + "-" + season.toString() + "-" + episode.toString() + "?ui=" + token;
  if (region != "") url = url + "&region=" + region;
  return url;
}

export function buildFemboxHlsUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32, token: string, region: string): string {
  let path: string;
  if (mediaType == "tv") {
    path = "/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString();
  } else {
    path = "/movie/" + tmdbId.toString();
  }
  let url = "https://fembox.aether.mom/hls" + path + "?ui=" + token;
  if (region != "") url = url + "&region=" + region;
  return url;
}

// --- Bcine ---

export function buildBcineApiUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://bcine.app/api/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString();
  } else {
    return "https://bcine.app/api/movie/" + tmdbId.toString();
  }
}

export function buildBcineProxyUrl(destination: string, referer: string, headersJson: string): string {
  let q = "destination=" + encodeUriComponent(destination);
  if (referer != "") q = q + "&ref=" + encodeUriComponent(referer);
  if (headersJson != "") q = q + "&headers=" + encodeUriComponent(headersJson);
  return "https://node8.neshanwonderbiz.workers.dev/?" + q;
}

/** Decrypt bs_ prefixed URL (base64 decode + reverse). */
export function decryptBcineUrl(encryptedUrl: string): string {
  if (encryptedUrl.length < 3 || encryptedUrl.substring(0, 3) != "bs_") return encryptedUrl;
  const b64 = encryptedUrl.substring(3);
  const decoded = atobBase64(b64);
  return reverseString(decoded);
}

function reverseString(s: string): string {
  let result = "";
  const len = s.length;
  for (let i = len - 1; i >= 0; i--) {
    result = result + s.charAt(i);
  }
  return result;
}

// --- Aurora ---

export function buildAuroraApiUrl(name: string, year: string, tmdbId: i32, mediaType: string, season: i32, episode: i32, cacheBuster: string): string {
  let q = "name=" + encodeUriComponent(name) + "&year=" + year + "&id=" + tmdbId.toString() + "&type=" + (mediaType == "tv" ? "2" : "1") + "&_cb=" + cacheBuster;
  if (mediaType == "tv") {
    q = q + "&s=" + season.toString() + "&e=" + episode.toString();
  }
  return "https://stream.aurorascreen.org/?" + q;
}

export function buildAuroraM3u8ProxyUrl(url: string): string {
  return "https://proxy.icefy.top/m3u8-proxy?url=" + encodeUriComponent(url);
}

// --- Dougoil ---

export function buildDougoilEmbedUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://play.xpass.top/e/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString() + "?autostart=true";
  } else {
    return "https://play.xpass.top/e/movie/" + tmdbId.toString() + "?autostart=true";
  }
}

export function buildDougoilProxyUrl(targetUrl: string): string {
  return "https://proxy.moviebay.cc/?destination=" + encodeUriComponent(targetUrl);
}

export function buildDougoilM3u8ProxyUrl(url: string): string {
  return "https://proxy.icefy.top/m3u8-proxy?url=" + encodeUriComponent(url);
}

// --- Amri ---

export function buildAmriApiUrl(tmdbId: i32, season: i32, episode: i32): string {
  let q = "tmdb=" + tmdbId.toString();
  if (season >= 0 && episode >= 0) {
    q = q + "&season=" + season.toString() + "&episode=" + episode.toString();
  }
  return "https://amri.gg/api/sources?" + q;
}

// --- Xpass ---

export function buildXPassApiUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://play.xpass.top/meg/tv/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString() + "/playlist.json";
  } else {
    return "https://play.xpass.top/feb/" + tmdbId.toString() + "/0/0/0/playlist.json";
  }
}

// --- YFlix ---

export function buildYFlixFindUrl(tmdbId: i32, mediaType: string): string {
  return "https://enc-dec.app/db/flix/find?tmdb_id=" + tmdbId.toString() + "&type=" + mediaType;
}

export function buildYFlixEncUrl(text: string): string {
  return "https://enc-dec.app/api/enc-movies-flix?text=" + encodeUriComponent(text);
}

export function buildYFlixDecUrl(): string {
  return "https://enc-dec.app/api/dec-movies-flix";
}

export function buildYFlixLinksUrl(eid: string, encId: string): string {
  return "https://solarmovie.fi/ajax/links/list?eid=" + eid + "&_=" + encId;
}

export function buildYFlixViewUrl(lid: string, encLid: string): string {
  return "https://solarmovie.fi/ajax/links/view?id=" + lid + "&_=" + encLid;
}

export function buildYFlixMediaUrl(embedUrl: string): string {
  return embedUrl.replace("/e/", "/media/");
}

// --- MovieBox ---

export function buildMovieBoxInitUrl(): string {
  return "https://h5.aoneroom.com/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox";
}

export function buildMovieBoxSearchUrl(): string {
  return "https://h5.aoneroom.com/wefeed-h5-bff/web/subject/search";
}

export function buildMovieBoxDetailUrl(subjectId: string): string {
  return "https://h5.aoneroom.com/wefeed-h5-bff/web/subject/detail?subjectId=" + encodeUriComponent(subjectId);
}

export function buildMovieBoxDownloadUrl(subjectId: string, mediaType: string, season: i32, episode: i32): string {
  let q = "subjectId=" + encodeUriComponent(subjectId);
  if (mediaType == "tv") {
    q = q + "&se=" + season.toString() + "&ep=" + episode.toString();
  }
  return "https://h5.aoneroom.com/wefeed-h5-bff/web/subject/download?" + q;
}

// --- Hexa ---

export function buildHexaApiUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://themoviedb.vidsrc.ru/api/tmdb/tv/" + tmdbId.toString() + "/season/" + season.toString() + "/episode/" + episode.toString() + "/images";
  } else {
    return "https://themoviedb.vidsrc.ru/api/tmdb/movie/" + tmdbId.toString() + "/images";
  }
}

export function buildHexaDecUrl(): string {
  return "https://enc-dec.app/api/dec-hexa";
}

// --- SmashyStream ---

export function buildSmashyStreamTokenUrl(): string {
  return "https://enc-dec.app/api/enc-vidstack";
}

export function buildSmashyStreamPlayerUrl(imdbId: string, tmdbId: i32, mediaType: string, season: i32, episode: i32, token: string, userId: string): string {
  if (mediaType == "tv") {
    return "https://api.smashystream.top/api/v1/videosmashyi/" + imdbId + "/" + tmdbId.toString() + "/" + season.toString() + "/" + episode.toString() + "?token=" + token + "&user_id=" + userId;
  } else {
    return "https://api.smashystream.top/api/v1/videosmashyi/" + imdbId + "?token=" + token + "&user_id=" + userId;
  }
}

export function buildSmashyStreamVideoUrl(host: string, id: string): string {
  return host + "/api/v1/video?id=" + id;
}

export function buildSmashyStreamDecUrl(): string {
  return "https://enc-dec.app/api/dec-vidstack";
}

// --- Showbox ---

export function buildShowboxShareUrl(movieId: string, type: string): string {
  return "https://www.showbox.media/index/share_link?id=" + movieId + "&type=" + type;
}

export function buildShowboxSearchUrl(keyword: string): string {
  return "https://www.showbox.media/search?keyword=" + encodeUriComponent(keyword);
}

export function buildShowboxMovieDetailUrl(movieUrl: string): string {
  if (movieUrl.startsWith("http")) return movieUrl;
  return "https://www.showbox.media" + movieUrl;
}

export function buildShowboxFileShareInfoUrl(shareKey: string): string {
  return "https://www.febbox.com/file/share_info?key=" + shareKey;
}

export function buildShowboxFileShareListUrl(shareKey: string, parentId: string): string {
  return "https://www.febbox.com/file/file_share_list?share_key=" + shareKey + "&pwd=&parent_id=" + parentId;
}

export function buildShowboxProxyBase(): string {
  return "https://proxy.moviebay.cc/?destination=";
}

// --- VxrMovie ---

export function buildVxrMovieUrl(id: string): string {
  return "https://cdn.madplay.site/vxr/?id=" + id + "&type=movie";
}

export function buildVxrM3u8ProxyUrl(url: string): string {
  return "https://proxy.icefy.top/m3u8-proxy?url=" + encodeUriComponent(url);
}

export function extractVxrOriginalUrl(proxyUrl: string): string {
  const prefix = "https://hlsproxy3.asiaflix.net/m3u8-proxy?url=";
  if (proxyUrl.indexOf(prefix) >= 0) {
    const start = prefix.length;
    return proxyUrl.substring(start);
  }
  return proxyUrl;
}

// --- Uembed (MadPlay) ---

export function buildMadPlayCdnUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://cdn.madplay.site/api/hls/unknown/" + tmdbId.toString() + "/season_" + season.toString() + "/episode_" + episode.toString() + "/master.m3u8";
  } else {
    return "https://cdn.madplay.site/api/hls/unknown/" + tmdbId.toString() + "/master.m3u8";
  }
}

export function buildMadPlayApiUrl(tmdbId: i32, mediaType: string, season: i32, episode: i32): string {
  if (mediaType == "tv") {
    return "https://api.madplay.site/api/rogflix?id=" + tmdbId.toString() + "&season=" + season.toString() + "&episode=" + episode.toString() + "&type=series";
  } else {
    return "https://api.madplay.site/api/rogflix?id=" + tmdbId.toString() + "&type=movie";
  }
}

// --- Helpers ---

function encodeUriComponent(s: string): string {
  let result = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const c = s.charAt(i);
    if (c == " ") result += " ";
    else if (c == "!") result += "!";
    else if (c == "(") result += "(";
    else if (c == ")") result += ")";
    else if (c == "~") result += "~";
    else if (c == "'") result += "'";
    else if (c == "-") result += "-";
    else if (c == "_") result += "_";
    else if (c == ".") result += ".";
    else if (c >= "0" && c <= "9") result += c;
    else if (c >= "A" && c <= "Z") result += c;
    else if (c >= "a" && c <= "z") result += c;
    else {
      const code = c.charCodeAt(0);
      result += "%" + code.toString(16).toUpperCase();
    }
  }
  return result;
}

function atobBase64(s: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  const len = s.length;
  while (i < len) {
    const a = chars.indexOf(s.charAt(i));
    const b = i + 1 < len ? chars.indexOf(s.charAt(i + 1)) : -1;
    const c = i + 2 < len ? chars.indexOf(s.charAt(i + 2)) : -1;
    const d = i + 3 < len ? chars.indexOf(s.charAt(i + 3)) : -1;
    const n = (a >= 0 ? a : 0) << 18 | (b >= 0 ? b : 0) << 12 | (c >= 0 ? c : 0) << 6 | (d >= 0 ? d : 0);
    result = result + String.fromCharCode((n >> 16) & 0xff);
    if (c >= 0) result = result + String.fromCharCode((n >> 8) & 0xff);
    if (d >= 0) result = result + String.fromCharCode(n & 0xff);
    i += 4;
  }
  return result;
}
