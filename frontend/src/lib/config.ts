export const config = {
	tmdb: {
		apiKey: import.meta.env.VITE_TMDB_API_KEY || '',
		baseUrl: 'https://api.themoviedb.org/3',
		imageBaseUrl: 'https://image.tmdb.org/t/p/'
	},
	backend: {
		// Direct to backend — bypasses Vite proxy; set VITE_API_BASE_URL in .env / .env.production
		baseUrl: (import.meta.env?.VITE_API_BASE_URL as string) || ''
	}
};

export const tmdbEndpoints = {
	trending: {
		movies: '/trending/movie/week',
		tv: '/trending/tv/week'
	},
	popular: {
		movies: '/movie/popular',
		tv: '/tv/popular'
	},
	discover: {
		movies: '/discover/movie',
		tv: '/discover/tv'
	},
	genres: {
		movies: '/genre/movie/list',
		tv: '/genre/tv/list'
	},
	search: '/search/multi'
};

export const imageSizes = {
	poster: {
		small: 'w185',
		medium: 'w342',
		large: 'w500',
		original: 'original'
	},
	backdrop: {
		small: 'w300',
		medium: 'w780',
		large: 'w1280',
		original: 'original'
	},
	profile: {
		small: 'w45',
		medium: 'w185',
		large: 'h632',
		original: 'original'
	}
};
