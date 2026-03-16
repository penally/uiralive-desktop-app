import React, { useState, useEffect } from 'react';
import { config, imageSizes } from '../lib/config';
import WatchlistControls from './WatchlistControls';

interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
}

interface MovieDisplayProps {
  tmdbId: number;
}

const MovieDisplay: React.FC<MovieDisplayProps> = ({ tmdbId }) => {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const response = await fetch(`${config.tmdb.baseUrl}/movie/${tmdbId}?api_key=${config.tmdb.apiKey}`);
        if (!response.ok) {
          throw new Error('Failed to fetch movie');
        }
        const data = await response.json();
        setMovie(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, []);

  if (loading) {
    return <div className="text-white">Loading movie...</div>;
  }

  if (error) {
    return <div className="text-red-400">Error: {error}</div>;
  }

  if (!movie) {
    return <div className="text-white">No movie data</div>;
  }

  const posterUrl = movie.poster_path
    ? `${config.tmdb.imageBaseUrl}${imageSizes.poster.large}${movie.poster_path}`
    : null;

  return (
    <div className="text-white">
      <h3 className="text-xl font-bold mb-2">TMDB ID {tmdbId}: {movie.title}</h3>
      {posterUrl && (
        <img
          src={posterUrl}
          alt={movie.title}
          className="w-32 h-48 object-cover rounded mb-2"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <p className="text-sm text-gray-300 mb-2">Release Year: {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</p>
      <p className="text-sm text-gray-300 mb-4">{movie.overview}</p>
      <WatchlistControls tmdbId={tmdbId} movieTitle={movie.title} />
    </div>
  );
};

export default MovieDisplay;