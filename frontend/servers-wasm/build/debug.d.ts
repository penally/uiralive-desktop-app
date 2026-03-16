/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * assembly/index/buildIcefyUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildIcefyUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/parseIcefyResponse
 * @param url `~lib/string/String`
 * @param text `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function parseIcefyResponse(url: string, text: string): string;
/**
 * assembly/index/buildVixsrcPageUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVixsrcPageUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildVixsrcPlaylistUrl
 * @param videoId `~lib/string/String`
 * @param token `~lib/string/String`
 * @param expires `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildVixsrcPlaylistUrl(videoId: string, token: string, expires: string): string;
/**
 * assembly/index/parseVixsrcScript
 * @param scriptContent `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function parseVixsrcScript(scriptContent: string): string;
/**
 * assembly/index/isAllowedOrigin
 * @param origin `~lib/string/String`
 * @returns `bool`
 */
export declare function isAllowedOrigin(origin: string): boolean;
/**
 * assembly/index/buildVidfastMediaUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVidfastMediaUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildVidfastEncDecUrl
 * @param rawData `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildVidfastEncDecUrl(rawData: string): string;
/**
 * assembly/index/extractVidfastRawData
 * @param pageHtml `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function extractVidfastRawData(pageHtml: string): string;
/**
 * assembly/index/parseVidfastEncDecResponse
 * @param jsonStr `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function parseVidfastEncDecResponse(jsonStr: string): string;
/**
 * assembly/index/buildVideasySourcesUrl
 * @param title `~lib/string/String`
 * @param mediaType `~lib/string/String`
 * @param year `~lib/string/String`
 * @param tmdbId `i32`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVideasySourcesUrl(title: string, mediaType: string, year: string, tmdbId: number, season: number, episode: number): string;
/**
 * assembly/index/buildVideasyDecryptUrl
 * @returns `~lib/string/String`
 */
export declare function buildVideasyDecryptUrl(): string;
/**
 * assembly/index/buildVidlinkEncUrl
 * @param tmdbId `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVidlinkEncUrl(tmdbId: number): string;
/**
 * assembly/index/buildVidlinkApiUrl
 * @param encryptedId `~lib/string/String`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVidlinkApiUrl(encryptedId: string, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/extractQualityFromStream
 * @param streamData `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function extractQualityFromStream(streamData: string): string;
/**
 * assembly/index/buildVidnestMovieUrl
 * @param backendId `~lib/string/String`
 * @param tmdbId `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVidnestMovieUrl(backendId: string, tmdbId: number): string;
/**
 * assembly/index/buildVidnestTvUrl
 * @param backendId `~lib/string/String`
 * @param tmdbId `i32`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildVidnestTvUrl(backendId: string, tmdbId: number, season: number, episode: number): string;
/**
 * assembly/index/buildProxyDestinationUrl
 * @param destination `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildProxyDestinationUrl(destination: string): string;
/**
 * assembly/index/buildMovieBayProxyUrl
 * @param url `~lib/string/String`
 * @param headersJson `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildMovieBayProxyUrl(url: string, headersJson: string): string;
/**
 * assembly/index/buildFemboxMovieUrl
 * @param tmdbId `i32`
 * @param token `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildFemboxMovieUrl(tmdbId: number, token: string): string;
/**
 * assembly/index/buildFemboxTvUrl
 * @param tmdbId `i32`
 * @param season `i32`
 * @param episode `i32`
 * @param token `~lib/string/String`
 * @param region `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildFemboxTvUrl(tmdbId: number, season: number, episode: number, token: string, region: string): string;
/**
 * assembly/index/buildFemboxHlsUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @param token `~lib/string/String`
 * @param region `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildFemboxHlsUrl(tmdbId: number, mediaType: string, season: number, episode: number, token: string, region: string): string;
/**
 * assembly/index/buildBcineApiUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildBcineApiUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildBcineProxyUrl
 * @param destination `~lib/string/String`
 * @param referer `~lib/string/String`
 * @param headersJson `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildBcineProxyUrl(destination: string, referer: string, headersJson: string): string;
/**
 * assembly/index/decryptBcineUrl
 * @param encryptedUrl `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function decryptBcineUrl(encryptedUrl: string): string;
/**
 * assembly/index/buildAuroraApiUrl
 * @param name `~lib/string/String`
 * @param year `~lib/string/String`
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @param cacheBuster `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildAuroraApiUrl(name: string, year: string, tmdbId: number, mediaType: string, season: number, episode: number, cacheBuster: string): string;
/**
 * assembly/index/buildAuroraM3u8ProxyUrl
 * @param url `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildAuroraM3u8ProxyUrl(url: string): string;
/**
 * assembly/index/buildDougoilEmbedUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildDougoilEmbedUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildDougoilProxyUrl
 * @param targetUrl `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildDougoilProxyUrl(targetUrl: string): string;
/**
 * assembly/index/buildDougoilM3u8ProxyUrl
 * @param url `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildDougoilM3u8ProxyUrl(url: string): string;
/**
 * assembly/index/buildAmriApiUrl
 * @param tmdbId `i32`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildAmriApiUrl(tmdbId: number, season: number, episode: number): string;
/**
 * assembly/index/buildXPassApiUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildXPassApiUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildYFlixFindUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildYFlixFindUrl(tmdbId: number, mediaType: string): string;
/**
 * assembly/index/buildYFlixEncUrl
 * @param text `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildYFlixEncUrl(text: string): string;
/**
 * assembly/index/buildYFlixDecUrl
 * @returns `~lib/string/String`
 */
export declare function buildYFlixDecUrl(): string;
/**
 * assembly/index/buildYFlixLinksUrl
 * @param eid `~lib/string/String`
 * @param encId `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildYFlixLinksUrl(eid: string, encId: string): string;
/**
 * assembly/index/buildYFlixViewUrl
 * @param lid `~lib/string/String`
 * @param encLid `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildYFlixViewUrl(lid: string, encLid: string): string;
/**
 * assembly/index/buildYFlixMediaUrl
 * @param embedUrl `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildYFlixMediaUrl(embedUrl: string): string;
/**
 * assembly/index/buildMovieBoxInitUrl
 * @returns `~lib/string/String`
 */
export declare function buildMovieBoxInitUrl(): string;
/**
 * assembly/index/buildMovieBoxSearchUrl
 * @returns `~lib/string/String`
 */
export declare function buildMovieBoxSearchUrl(): string;
/**
 * assembly/index/buildMovieBoxDetailUrl
 * @param subjectId `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildMovieBoxDetailUrl(subjectId: string): string;
/**
 * assembly/index/buildMovieBoxDownloadUrl
 * @param subjectId `~lib/string/String`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildMovieBoxDownloadUrl(subjectId: string, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildHexaApiUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildHexaApiUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildHexaDecUrl
 * @returns `~lib/string/String`
 */
export declare function buildHexaDecUrl(): string;
/**
 * assembly/index/buildSmashyStreamTokenUrl
 * @returns `~lib/string/String`
 */
export declare function buildSmashyStreamTokenUrl(): string;
/**
 * assembly/index/buildSmashyStreamPlayerUrl
 * @param imdbId `~lib/string/String`
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @param token `~lib/string/String`
 * @param userId `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildSmashyStreamPlayerUrl(imdbId: string, tmdbId: number, mediaType: string, season: number, episode: number, token: string, userId: string): string;
/**
 * assembly/index/buildSmashyStreamVideoUrl
 * @param host `~lib/string/String`
 * @param id `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildSmashyStreamVideoUrl(host: string, id: string): string;
/**
 * assembly/index/buildSmashyStreamDecUrl
 * @returns `~lib/string/String`
 */
export declare function buildSmashyStreamDecUrl(): string;
/**
 * assembly/index/buildShowboxShareUrl
 * @param movieId `~lib/string/String`
 * @param type `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildShowboxShareUrl(movieId: string, type: string): string;
/**
 * assembly/index/buildShowboxSearchUrl
 * @param keyword `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildShowboxSearchUrl(keyword: string): string;
/**
 * assembly/index/buildShowboxMovieDetailUrl
 * @param movieUrl `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildShowboxMovieDetailUrl(movieUrl: string): string;
/**
 * assembly/index/buildShowboxFileShareInfoUrl
 * @param shareKey `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildShowboxFileShareInfoUrl(shareKey: string): string;
/**
 * assembly/index/buildShowboxFileShareListUrl
 * @param shareKey `~lib/string/String`
 * @param parentId `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildShowboxFileShareListUrl(shareKey: string, parentId: string): string;
/**
 * assembly/index/buildShowboxProxyBase
 * @returns `~lib/string/String`
 */
export declare function buildShowboxProxyBase(): string;
/**
 * assembly/index/buildVxrMovieUrl
 * @param id `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildVxrMovieUrl(id: string): string;
/**
 * assembly/index/buildVxrM3u8ProxyUrl
 * @param url `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function buildVxrM3u8ProxyUrl(url: string): string;
/**
 * assembly/index/extractVxrOriginalUrl
 * @param proxyUrl `~lib/string/String`
 * @returns `~lib/string/String`
 */
export declare function extractVxrOriginalUrl(proxyUrl: string): string;
/**
 * assembly/index/buildMadPlayCdnUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildMadPlayCdnUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
/**
 * assembly/index/buildMadPlayApiUrl
 * @param tmdbId `i32`
 * @param mediaType `~lib/string/String`
 * @param season `i32`
 * @param episode `i32`
 * @returns `~lib/string/String`
 */
export declare function buildMadPlayApiUrl(tmdbId: number, mediaType: string, season: number, episode: number): string;
