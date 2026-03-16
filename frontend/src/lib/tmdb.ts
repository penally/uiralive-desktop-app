import { config, tmdbEndpoints, imageSizes } from "./config";
import { getImageSize } from "./performanceUtils";

export interface TMDBMovie {
	id: number;
	title: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string;
	vote_average: number;
	vote_count: number;
	genre_ids: number[];
	adult: boolean;
	original_language: string;
	original_title: string;
	popularity: number;
	video: boolean;
	production_countries?: { iso_3166_1: string; name: string }[];
}

export interface TMDBSeries {
	id: number;
	name: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	first_air_date: string;
	vote_average: number;
	vote_count: number;
	genre_ids: number[];
	adult: boolean;
	original_language: string;
	original_name: string;
	popularity: number;
	origin_country: string[];
}

export interface TMDBGenre {
	id: number;
	name: string;
}

export interface TMDBProductionCompany {
	id: number;
	name: string;
	logo_path: string | null;
	origin_country: string;
}

export interface TMDBResponse<T> {
	page: number;
	results: T[];
	total_pages: number;
	total_results: number;
}

export interface TMDBMultiSearchResult {
	id: number;
  media_type: "movie" | "tv" | "person";
	title?: string;
	name?: string;
	poster_path: string | null;
	backdrop_path: string | null;
	overview: string;
	release_date?: string;
	first_air_date?: string;
	vote_average: number;
	genre_ids?: number[];
}

// Normalized item used across the app (movie + tv)
export type TMDBItem =
  | (TMDBMovie & { media_type: "movie" })
  | (TMDBSeries & { media_type: "tv" });

// Detail item with optional images (logos) and extra fields
export interface TMDBDetailImagesLogo {
  file_path: string;
  iso_639_1: string | null;
}

export interface TMDBDetailItemBase {
  id: number;
  overview: string;
  genres?: TMDBGenre[];
  tagline?: string;
  homepage?: string;
  images?: {
    logos?: TMDBDetailImagesLogo[];
  };
}

export type TMDBDetailItem =
  | (TMDBDetailItemBase & {
      media_type: "movie";
      title: string;
      release_date?: string;
      name?: never;
      first_air_date?: never;
    })
  | (TMDBDetailItemBase & {
      media_type: "tv";
      name: string;
      first_air_date?: string;
      title?: never;
      release_date?: never;
    });

class TMDBApi {
	private apiKey: string;
	private baseUrl: string;

	constructor() {
		this.apiKey = config.tmdb.apiKey;
		this.baseUrl = config.tmdb.baseUrl;
	}

  private getPreferredLanguage(): string {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      const stored = window.localStorage.getItem("uira-language");
      if (stored && stored.trim().length > 0) {
        return stored;
      }
    }
    return "en-US";
  }

  private async fetchApi<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
		if (!this.apiKey) {
      throw new Error(
        "TMDB API key is not configured. Please set VITE_TMDB_API_KEY in your .env file."
      );
		}

		const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append("api_key", this.apiKey);
    url.searchParams.append("language", this.getPreferredLanguage());
    url.searchParams.append("include_adult", "false");

		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value.toString());
		});

		try {
			const response = await fetch(url.toString());
			if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as { status_message?: string; message?: string };
        const errorMessage =
          errorData.status_message || errorData.message || response.statusText;
				throw new Error(`TMDB API error (${response.status}): ${errorMessage}`);
			}

			return response.json() as Promise<T>;
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error(`Network error: ${String(error)}`);
		}
	}

	// Movie methods
	async getTrendingMovies(page: number = 1): Promise<TMDBResponse<TMDBMovie>> {
    return this.fetchApi<TMDBResponse<TMDBMovie>>(
      tmdbEndpoints.trending.movies,
      { page }
    );
	}

	async getPopularMovies(page: number = 1): Promise<TMDBResponse<TMDBMovie>> {
    return this.fetchApi<TMDBResponse<TMDBMovie>>(tmdbEndpoints.popular.movies, {
      page,
    });
	}

	async getTrendingTV(page: number = 1): Promise<TMDBResponse<TMDBSeries>> {
    return this.fetchApi<TMDBResponse<TMDBSeries>>(tmdbEndpoints.trending.tv, {
      page,
    });
	}

	async getPopularTV(page: number = 1): Promise<TMDBResponse<TMDBSeries>> {
    return this.fetchApi<TMDBResponse<TMDBSeries>>(tmdbEndpoints.popular.tv, {
      page,
    });
	}

  /**
   * Discover movies. See https://developer.themoviedb.org/reference/discover-movie
   * - sort_by: popularity.desc | primary_release_date.desc | vote_average.desc | etc.
   * - with_genres: comma (AND) or pipe (OR) separated movie genre IDs from /genre/movie/list
   * - primary_release_year: int
   * - primary_release_date.gte / .lte: date range
   */
  async discoverMovies(
    params: Record<string, string | number> = {}
  ): Promise<TMDBResponse<TMDBMovie>> {
    const { page = 1, ...rest } = params;
    return this.fetchApi<TMDBResponse<TMDBMovie>>(
      tmdbEndpoints.discover.movies,
      { page, ...rest }
    );
  }

  /**
   * Discover TV. See https://developer.themoviedb.org/reference/discover-tv
   * - sort_by: popularity.desc | first_air_date.desc | vote_average.desc | etc.
   * - with_genres: comma (AND) or pipe (OR) separated TV genre IDs from /genre/tv/list
   * - first_air_date_year: int
   * - first_air_date.gte / .lte: date range
   * - vote_count.gte: min votes for top-rated
   */
  async discoverTV(
    params: Record<string, string | number> = {}
  ): Promise<TMDBResponse<TMDBSeries>> {
    const { page = 1, ...rest } = params;
    return this.fetchApi<TMDBResponse<TMDBSeries>>(
      tmdbEndpoints.discover.tv,
      { page, include_null_first_air_dates: "false", ...rest }
    );
  }

  /**
   * Get movie genres. IDs must be used with discoverMovies with_genres.
   * See https://developer.themoviedb.org/reference/genre-movie-list
   */
  async getMovieGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.fetchApi<{ genres: TMDBGenre[] }>(tmdbEndpoints.genres.movies);
  }

  /**
   * Get TV genres. IDs must be used with discoverTV with_genres.
   * Movie and TV have different genre IDs - do not mix.
   * See https://developer.themoviedb.org/reference/genre-tv-list
   */
  async getTVGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.fetchApi<{ genres: TMDBGenre[] }>(tmdbEndpoints.genres.tv);
  }

  async searchMulti(
    query: string,
    page: number = 1
  ): Promise<TMDBResponse<TMDBMultiSearchResult>> {
    return this.fetchApi<TMDBResponse<TMDBMultiSearchResult>>(
      tmdbEndpoints.search,
      {
			query, 
        page,
      }
    );
	}

  async getMovieDetails(
    movieId: number
  ): Promise<
    TMDBMovie & {
      genres: TMDBGenre[];
      tagline?: string;
      homepage?: string;
      images?: { logos?: TMDBDetailImagesLogo[] };
      production_companies?: TMDBProductionCompany[];
    }
  > {
    return this.fetchApi<
      TMDBMovie & {
        genres: TMDBGenre[];
        tagline?: string;
        homepage?: string;
        images?: { logos?: TMDBDetailImagesLogo[] };
        production_companies?: TMDBProductionCompany[];
      }
    >(`/movie/${movieId}`, { append_to_response: "images" });
	}

  async getTVDetails(
    tvId: number
  ): Promise<
    TMDBSeries & {
      genres: TMDBGenre[];
      tagline?: string;
      homepage?: string;
      images?: { logos?: TMDBDetailImagesLogo[] };
      production_companies?: TMDBProductionCompany[];
    }
  > {
    return this.fetchApi<
      TMDBSeries & {
        genres: TMDBGenre[];
        tagline?: string;
        homepage?: string;
        images?: { logos?: TMDBDetailImagesLogo[] };
        production_companies?: TMDBProductionCompany[];
      }
    >(`/tv/${tvId}`, { append_to_response: "images" });
	}

  async getMovieWatchProviders(
    movieId: number
  ): Promise<{
    results: {
      [countryCode: string]: {
        flatrate?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
        }[];
      };
    };
  }> {
    return this.fetchApi<{
      results: {
        [countryCode: string]: {
          flatrate?: {
            provider_id: number;
            provider_name: string;
            logo_path: string;
          }[];
        };
      };
    }>(`/movie/${movieId}/watch/providers`);
	}

  async getTVWatchProviders(
    tvId: number
  ): Promise<{
    results: {
      [countryCode: string]: {
        flatrate?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
        }[];
      };
    };
  }> {
    return this.fetchApi<{
      results: {
        [countryCode: string]: {
          flatrate?: {
            provider_id: number;
            provider_name: string;
            logo_path: string;
          }[];
        };
      };
    }>(`/tv/${tvId}/watch/providers`);
	}

  async getMovieCredits(
    movieId: number
  ): Promise<{
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }>;
  }> {
    return this.fetchApi<{
      cast: Array<{
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
        order: number;
      }>;
    }>(`/movie/${movieId}/credits`);
	}

  async getMovieCollection(
    collectionId: number
  ): Promise<{
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    parts: TMDBMovie[];
  }> {
    return this.fetchApi<{
      id: number;
      name: string;
      overview: string;
      poster_path: string | null;
      backdrop_path: string | null;
      parts: TMDBMovie[];
    }>(`/collection/${collectionId}`);
	}

  async getTVCredits(
    tvId: number
  ): Promise<{
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }>;
  }> {
    return this.fetchApi<{
      cast: Array<{
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
        order: number;
      }>;
    }>(`/tv/${tvId}/credits`);
	}

  async getMovieVideos(
    movieId: number
  ): Promise<{
    results: Array<{ key: string; type: string; site: string; name: string }>;
  }> {
    return this.fetchApi<{
      results: Array<{ key: string; type: string; site: string; name: string }>;
    }>(`/movie/${movieId}/videos`);
	}

  async getTVVideos(
    tvId: number
  ): Promise<{
    results: Array<{ key: string; type: string; site: string; name: string }>;
  }> {
    return this.fetchApi<{
      results: Array<{ key: string; type: string; site: string; name: string }>;
    }>(`/tv/${tvId}/videos`);
	}

  /**
   * Get TV season episodes. See https://developer.themoviedb.org/reference/tv-season-details
   */
  async getTVSeasonEpisodes(
    tvId: number,
    seasonNumber: number
  ): Promise<{
    episodes: Array<{
      id: number;
      name: string;
      overview: string;
      episode_number: number;
      still_path: string | null;
      runtime: number;
      air_date: string;
    }>;
  }> {
    return this.fetchApi<{
      episodes: Array<{
        id: number;
        name: string;
        overview: string;
        episode_number: number;
        still_path: string | null;
        runtime: number;
        air_date: string;
      }>;
    }>(`/tv/${tvId}/season/${seasonNumber}`);
  }

  async getMovieImages(
    movieId: number
  ): Promise<{
    logos: Array<{ file_path: string; iso_639_1: string }>;
  }> {
    return this.fetchApi<{
      logos: Array<{ file_path: string; iso_639_1: string }>;
    }>(`/movie/${movieId}/images`);
	}

  async getTVImages(
    tvId: number
  ): Promise<{
    logos: Array<{ file_path: string; iso_639_1: string }>;
  }> {
    return this.fetchApi<{
      logos: Array<{ file_path: string; iso_639_1: string }>;
    }>(`/tv/${tvId}/images`);
	}

  async getMovieCertification(
    movieId: number
  ): Promise<{
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification: string; type: number }>;
    }>;
  }> {
    return this.fetchApi<{
      results: Array<{
        iso_3166_1: string;
        release_dates: Array<{ certification: string; type: number }>;
      }>;
    }>(`/movie/${movieId}/release_dates`);
	}

  async getTVContentRatings(
    tvId: number
  ): Promise<{
    results: Array<{ iso_3166_1: string; rating: string }>;
  }> {
    return this.fetchApi<{
      results: Array<{ iso_3166_1: string; rating: string }>;
    }>(`/tv/${tvId}/content_ratings`);
	}
}

export const tmdbApi = new TMDBApi();

// Helper functions for image URLs
export const getImageUrl = (
  path: string | null,
  size: string,
  type: "poster" | "backdrop" | "profile" = "poster"
): string => {
  if (!path) return "";
	
	const sizeMap = {
		poster: imageSizes.poster,
		backdrop: imageSizes.backdrop,
    profile: imageSizes.profile,
	};
	
	// Use performance mode to get optimized size
	const optimizedSize = getImageSize(type, size);
  const sizeValue =
    sizeMap[type][optimizedSize as keyof (typeof sizeMap)[typeof type]] ||
    optimizedSize;
	const base = config.tmdb.imageBaseUrl.replace(/\/$/, "");
	const cleanPath = path.startsWith("/") ? path.slice(1) : path;
	return `${base}/${sizeValue}/${cleanPath}`;
};

export const getPosterUrl = (
  path: string | null,
  size: keyof typeof imageSizes.poster = "medium"
): string => {
  return getImageUrl(path, size, "poster");
};

export const getBackdropUrl = (
  path: string | null,
  size: keyof typeof imageSizes.backdrop = "large"
): string => {
  return getImageUrl(path, size, "backdrop");
};

// High-level helpers used by UI components
export async function getTrending(): Promise<TMDBItem[]> {
  const [movies, tv] = await Promise.all([
    tmdbApi.getTrendingMovies(),
    tmdbApi.getTrendingTV(),
  ]);

  const normalizedMovies: TMDBItem[] = movies.results.map((m) => ({
    ...m,
    media_type: "movie",
  }));
  const normalizedTV: TMDBItem[] = tv.results.map((t) => ({
    ...t,
    media_type: "tv",
  }));

  // Sort by popularity and take a reasonable number for the hero
  return [...normalizedMovies, ...normalizedTV]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 20);
}

export async function getItemDetails(
  id: number,
  mediaType: "movie" | "tv"
): Promise<TMDBDetailItem> {
  if (mediaType === "movie") {
    const data = await tmdbApi.getMovieDetails(id);
    return {
      ...data,
      media_type: "movie",
    };
  }

  const data = await tmdbApi.getTVDetails(id);
  return {
    ...data,
    media_type: "tv",
  };
}

export function getDisplayTitle(item: TMDBItem): string {
  return item.media_type === "movie"
    ? item.title
    : item.name ?? "";
}

export function getYear(item: TMDBItem): string | null {
  const date =
    item.media_type === "movie"
      ? item.release_date
      : (item.first_air_date as string | undefined);
  if (!date) return null;
  return date.split("-")[0] ?? null;
}
