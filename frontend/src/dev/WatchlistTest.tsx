import React, { useState, useEffect } from 'react';
import { config } from '../lib/config';

interface Media {
  id: number;
  tmdbId: number;
  type: string;
  title: string;
  posterPath?: string;
  overview?: string;
  releaseDate?: string;
}

interface WatchlistItem {
  id: number;
  addedAt: string;
  media: Media;
}

const WatchlistTest: React.FC = () => {
  const [movie, setMovie] = useState<Media | null>(null);
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const tmdbId = 22; // The Godfather

  useEffect(() => {
    fetchMovie();
    fetchWatchlistStatus();
  }, []);

  const fetchMovie = async () => {
    try {
      const response = await fetch(`${config.tmdb.baseUrl}/movie/${tmdbId}?api_key=${config.tmdb.apiKey}`);
      const data = await response.json();
      setMovie({
        id: 0, // Will be set by backend
        tmdbId,
        type: 'MOVIE',
        title: data.title,
        posterPath: data.poster_path,
        overview: data.overview,
        releaseDate: data.release_date,
      });
    } catch (error) {
      setMessage('Failed to fetch movie data');
    }
  };

  const fetchWatchlistStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${config.backend.baseUrl}/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: WatchlistItem[] = await response.json();
      const item = data.find(item => item.media.tmdbId === tmdbId);
      setWatchlistItem(item || null);
    } catch (error) {
      console.error('Failed to fetch watchlist');
    }
  };

  const addToWatchlist = async () => {
    if (!movie) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Please login first');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${config.backend.baseUrl}/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(movie),
      });
      if (response.ok) {
        const data = await response.json();
        setWatchlistItem(data);
        setMessage('Added to watchlist');
      } else {
        const error = await response.json();
        setMessage(error.error || 'Failed to add');
      }
    } catch (error) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  const removeFromWatchlist = async () => {
    if (!watchlistItem) return;
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${config.backend.baseUrl}/watchlist/${watchlistItem.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setWatchlistItem(null);
        setMessage('Removed from watchlist');
      } else {
        setMessage('Failed to remove');
      }
    } catch (error) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-md mx-auto text-white">
      <h2 className="text-2xl font-bold mb-4">Watchlist Test (TMDB ID: {tmdbId})</h2>
      {movie && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{movie.title}</h3>
          <p className="text-sm text-gray-300">{movie.overview}</p>
        </div>
      )}
      <div className="space-y-2">
        {!watchlistItem ? (
          <button
            onClick={addToWatchlist}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded disabled:opacity-50"
          >
            Add to Watchlist
          </button>
        ) : (
          <>
            <button
              onClick={removeFromWatchlist}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded disabled:opacity-50"
            >
              Remove from Watchlist
            </button>
            <p>Added: {new Date(watchlistItem.addedAt).toLocaleString()}</p>
          </>
        )}
      </div>
      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
};

export default WatchlistTest;