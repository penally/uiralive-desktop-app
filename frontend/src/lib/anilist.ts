export interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface AniListCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  color?: string | null;
}

export interface AniListMedia {
  id: number;
  title: AniListTitle;
  coverImage: AniListCoverImage;
  bannerImage?: string | null;
  averageScore?: number | null;
  episodes?: number | null;
  seasonYear?: number | null;
  format?: string | null;
}

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// Simple in-memory caches so we don't hammer AniList and hit rate limits
const listCache = new Map<string, AniListMedia[]>();
const detailsCache = new Map<
  number,
  AniListMedia & { description?: string | null; genres?: string[] | null; status?: string | null }
>();

async function fetchAnimeListRaw(sort: string[], perPage = 24): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int, $sort: [MediaSort]) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, sort: $sort, status_not_in: [NOT_YET_RELEASED]) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
            color
          }
          bannerImage
          averageScore
          episodes
          seasonYear
          format
        }
      }
    }
  `;

  const variables = { perPage, sort };

  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch from AniList");
  }

  const json = (await response.json()) as {
    data?: { Page?: { media?: AniListMedia[] } };
  };

  return json.data?.Page?.media ?? [];
}

async function fetchAnimeListCached(cacheKey: string, sort: string[]): Promise<AniListMedia[]> {
  const cached = listCache.get(cacheKey);
  if (cached) return cached;

  const media = await fetchAnimeListRaw(sort, 20);
  listCache.set(cacheKey, media);
  return media;
}

export const anilistApi = {
  getTrendingAnime(): Promise<AniListMedia[]> {
    return fetchAnimeListCached("trending", ["TRENDING_DESC"]);
  },
  getPopularAnime(): Promise<AniListMedia[]> {
    return fetchAnimeListCached("popular", ["POPULARITY_DESC"]);
  },
  getTopRatedAnime(): Promise<AniListMedia[]> {
    return fetchAnimeListCached("top", ["SCORE_DESC"]);
  },
  async searchAnime(query: string): Promise<AniListMedia[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `search:${trimmed.toLowerCase()}`;
    const cached = listCache.get(cacheKey);
    if (cached) return cached;

    const gql = `
      query ($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(type: ANIME, search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
              color
            }
            bannerImage
            averageScore
            episodes
            seasonYear
            format
          }
        }
      }
    `;

    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: gql, variables: { search: trimmed, perPage: 20 } }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("AniList rate limit reached. Please try again in a moment.");
      }
      throw new Error("Failed to search anime on AniList");
    }

    const json = (await response.json()) as {
      data?: { Page?: { media?: AniListMedia[] } };
    };
    const media = json.data?.Page?.media ?? [];
    listCache.set(cacheKey, media);
    return media;
  },
  async getAnimeDetails(id: number): Promise<AniListMedia & { description?: string | null; genres?: string[] | null; status?: string | null }> {
    const cached = detailsCache.get(id);
    if (cached) return cached;

    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
            color
          }
          bannerImage
          averageScore
          episodes
          seasonYear
          format
          status
          description(asHtml: false)
          genres
        }
      }
    `;

    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables: { id } }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("AniList rate limit reached. Please try again in a moment.");
      }
      throw new Error("Failed to fetch anime details from AniList");
    }

    const json = (await response.json()) as {
      data?: { Media?: AniListMedia & { description?: string | null; genres?: string[] | null; status?: string | null } };
    };

    if (!json.data?.Media) {
      throw new Error("Anime not found");
    }

    const media = json.data.Media;
    detailsCache.set(id, media);
    return media;
  },
};

