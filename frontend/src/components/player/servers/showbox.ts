import type { MediaSource } from '../lib/types';
import { loadServersWasm } from './wasmLoader';

async function getProxiedUrl(wasm: { buildShowboxProxyBase: () => string } | null, url: string): Promise<string> {
	if ((url.includes('www.showbox.media') || url.includes('www.febbox.com')) && wasm) {
		return wasm.buildShowboxProxyBase() + encodeURIComponent(url);
	}
	return url;
}

class ShowBox {
	async getShareKey(movieId: string, type: string = '1'): Promise<string | null> {
		const wasm = await loadServersWasm();
		const url = wasm ? wasm.buildShowboxShareUrl(movieId, type) : `https://www.showbox.media/index/share_link?id=${movieId}&type=${type}`;
		const proxyUrl = await getProxiedUrl(wasm, url);
		console.log(`Fetching share key from URL: ${proxyUrl}`);
		try {
			const response = await fetch(proxyUrl, { 
				headers: { Referer: 'https://watch.streamflix.one' } 
			});
			const movieData = await response.json() as { data: { link: string } };
			console.log(`Received movie data: ${JSON.stringify(movieData)}`);
			return movieData.data.link.split('/share/')[1];
		} catch (error) {
			console.error(`Error fetching share key: ${error}`);
			return null;
		}
	}

	async getName(id: string, season?: string, episode?: string): Promise<string | null> {
		const apiKey = 'f1dd7f2494de60ef4946ea81fd5ebaba';
		const baseUrl = season && episode ? 'https://api.themoviedb.org/3/tv/' : 'https://api.themoviedb.org/3/movie/';
		const endpoint = `${id}?api_key=${apiKey}&language=en-US`;
		const url = baseUrl + endpoint;
		console.log(`Fetching name from URL: ${url}`);
		try {
			const response = await fetch(url);
			const movieData = await response.json() as { name?: string; title?: string };
			console.log(`Received movie data: ${JSON.stringify(movieData)}`);
			return season && episode ? movieData.name || null : movieData.title || null;
		} catch (error) {
			console.error(`Error fetching name: ${error}`);
			return null;
		}
	}

	async fetchMovieDataByName(name: string): Promise<string | null> {
		const wasm = await loadServersWasm();
		const targetUrl = wasm ? wasm.buildShowboxSearchUrl(name) : `https://www.showbox.media/search?keyword=${encodeURIComponent(name)}`;
		const proxyTargetUrl = await getProxiedUrl(wasm, targetUrl);
		console.log(`Fetching movie data by name from URL: ${proxyTargetUrl}`);
		try {
			const response = await fetch(proxyTargetUrl);
			if (response.status === 200) {
				const html = await response.text();
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, 'text/html');
				const movieDivs = doc.querySelectorAll("div.flw-item");
				for (const movieDiv of movieDivs) {
					const title = movieDiv.querySelector("a.film-poster-ahref")?.getAttribute("title");
					if (title === name) {
						const movieUrl = movieDiv.querySelector("a.film-poster-ahref")?.getAttribute("href");
						const movieDetailUrl = wasm ? wasm.buildShowboxMovieDetailUrl((movieUrl || '').replace('http://', 'https://')) : `https://www.showbox.media${movieUrl}`;
						const proxyMovieDetailUrl = await getProxiedUrl(wasm, movieDetailUrl);
						console.log(`Fetching movie detail from URL: ${proxyMovieDetailUrl}`);
						const movieDetailResponse = await fetch(proxyMovieDetailUrl);
						const movieDetailHtml = await movieDetailResponse.text();
						const movieDetailDoc = parser.parseFromString(movieDetailHtml, 'text/html');
						const movieIdTag = movieDetailDoc.querySelector("h2.heading-name a");
						if (movieIdTag) {
							return movieIdTag.getAttribute("href")?.split("/").pop() || null;
						}
					}
				}
			}
			return null;
		} catch (error) {
			console.error(`Error fetching movie data by name: ${error}`);
			return null;
		}
	}

	async getDownloadLink(shareKey: string, type: string, season?: string, episode?: string): Promise<string | null> {
		const wasm = await loadServersWasm();
		const shareInfoUrl = wasm ? wasm.buildShowboxFileShareInfoUrl(shareKey) : `https://www.febbox.com/file/share_info?key=${shareKey}`;
		const proxyShareInfoUrl = await getProxiedUrl(wasm, shareInfoUrl);
		console.log(`Fetching download link from URL: ${proxyShareInfoUrl}`);
		try {
			const response = await fetch(proxyShareInfoUrl);
			const html = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			if (type === "tv") {
				const seasonDiv = doc.querySelector(`div[data-path="season ${season}"]`);
				if (seasonDiv) {
					const sid = seasonDiv.getAttribute("data-id") || null;
					const fileShareListUrl = wasm ? wasm.buildShowboxFileShareListUrl(shareKey, sid || '') : `https://www.febbox.com/file/file_share_list?share_key=${shareKey}&pwd=&parent_id=${sid}`;
					const proxyFileShareListUrl = await getProxiedUrl(wasm, fileShareListUrl);
					console.log(`Fetching file share list from URL: ${proxyFileShareListUrl}`);
					const fileShareListResponse = await fetch(proxyFileShareListUrl);
					const fileShareListData = await fileShareListResponse.json() as { data: { file_list: any[] } };
					console.log(`Received file share list response: ${JSON.stringify(fileShareListData)}`);
					const fileList = fileShareListData.data.file_list;
					const targetFile = fileList.find((file: any) => {
						if (file.file_name) {
							const parts = file.file_name.split('.');
							for (const part of parts) {
								if (part.toLowerCase().startsWith('s') && part.toLowerCase().includes('e')) {
									const seasonEpisode = part.toLowerCase().split('e');
									const seasonMatch = seasonEpisode[0].replace('s', '');
									const episodeMatch = seasonEpisode[1];
									console.log(`Checking file: ${file.file_name}, Season: ${seasonMatch}, Episode: ${episodeMatch}`);
									if (seasonMatch && episodeMatch && season && episode && parseInt(seasonMatch, 10) === parseInt(season, 10) && parseInt(episodeMatch, 10) === parseInt(episode, 10)) {
										return true;
									}
								}
							}
						}
						return false;
					});
					console.log(`Target file: ${targetFile ? targetFile.file_name : 'not found'}`);
					return targetFile ? targetFile.fid : null;
				}
			} else {
				const firstFile = doc.querySelector('.file');
				console.log(`First file: ${firstFile}`);
				return firstFile?.getAttribute('data-id') || null;
			}
			return null;
		} catch (error) {
			console.error(`Error fetching download link: ${error}`);
			return null;
		}
	}

	async fetchMp4(fid: string, shareKey: string, userToken?: string): Promise<{ download_url: string, quality: string }[] | null> {
		const url = "https://media-proxy.oct-cdn.co/api/fetchMp4";
		const data = {
			fid,
			share_key: shareKey,
			user_token: userToken || null
		};
		console.log(`Fetching MP4 links from URL: ${url} with data: ${JSON.stringify(data)}`);
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});
			if (response.ok) {
				const result = await response.json() as { sources: { download_url: string, quality: string }[] };
				return result.sources;
			}
			return null;
		} catch (error) {
			console.error(`Error fetching MP4 links: ${error}`);
			return null;
		}
	}

	async fetchSources(id: string, s?: string, e?: string): Promise<MediaSource[]> {
		console.log(`Fetching sources for ID: ${id}, Season: ${s}, Episode: ${e}`);
		let movieName: string | null;
		let movieId: string | null;
		let firstMovie: string | null;
		let fid: string | null;
		let getStreams: { download_url: string, quality: string }[] | null;

		if (s && e) {
			movieName = await this.getName(id, s, e);
			console.log(`Movie name: ${movieName}`);
			movieId = await this.fetchMovieDataByName(movieName?.replace("and", "&") || '');
			console.log(`Movie ID: ${movieId}`);
			firstMovie = await this.getShareKey(movieId || '', '2');
			console.log(`First movie share key: ${firstMovie}`);
			fid = await this.getDownloadLink(firstMovie || '', 'tv', s, e);
			console.log(`FID: ${fid}`);
		} else {
			movieName = await this.getName(id);
			console.log(`Movie name: ${movieName}`);
			movieId = await this.fetchMovieDataByName(movieName?.replace("and", "&") || '');
			console.log(`Movie ID: ${movieId}`);
			firstMovie = await this.getShareKey(movieId || '', '1');
			console.log(`First movie share key: ${firstMovie}`);
			fid = await this.getDownloadLink(firstMovie || '', 'movie');
			console.log(`FID: ${fid}`);
		}

		const userToken = typeof window !== 'undefined' ? localStorage.getItem('ui_token') : null;
		getStreams = await this.fetchMp4(fid || '', firstMovie || '', userToken || undefined);
		console.log(`Stream links: ${JSON.stringify(getStreams)}`);
		
		const formattedData: MediaSource[] = (getStreams
			?.filter(item => item.quality !== "ORG")
			.map(item => ({
				url: item.download_url,
				quality: item.quality,
				name: 'Bludclart',
				speed: '—',
				size: '—',
				type: 'hls'
			})) || []);

		console.log(`Formatted data sources: ${formattedData}`);
		return formattedData;
	}
}

export const showbox = new ShowBox();

