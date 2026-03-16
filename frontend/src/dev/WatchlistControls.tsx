import React, { useState, useEffect } from 'react';
import { config } from '../lib/config';

interface WatchlistItem {
  id: number;
  addedAt: string;
  media: {
    id: number;
    tmdbId: number;
    type: string;
    title: string;
    year: number | null;
    posterPath: string | null;
  };
}

interface WatchlistControlsProps {
  tmdbId: number;
  movieTitle: string;
}

const WatchlistControls: React.FC<WatchlistControlsProps> = ({ tmdbId, movieTitle: _movieTitle }) => {
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchWatchlistStatus();
  }, [tmdbId]);

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
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Please login first');
      setLoading(false);
      return;
    }

    // First fetch movie details from TMDB
    try {
      const movieResponse = await fetch(`${config.tmdb.baseUrl}/movie/${tmdbId}?api_key=${config.tmdb.apiKey}`);
      const movieData = await movieResponse.json();

      const response = await fetch(`${config.backend.baseUrl}/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tmdbId,
          type: 'MOVIE',
          title: movieData.title,
          year: movieData.release_date ? new Date(movieData.release_date).getFullYear() : null,
          posterPath: movieData.poster_path,
        }),
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
    <div className="mt-4">
      <h4 className="text-lg font-semibold mb-2">Watchlist Controls</h4>
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
            <p className="text-sm">Added: {new Date(watchlistItem.addedAt).toLocaleString()}</p>
          </>
        )}
      </div>
      {message && <p className="mt-2 text-sm text-center">{message}</p>}
    </div>
  );
};

export default WatchlistControls;