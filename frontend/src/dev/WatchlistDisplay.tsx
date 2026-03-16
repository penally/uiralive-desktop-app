import React, { useState, useEffect } from 'react';
import { config, imageSizes } from '../lib/config';

interface WatchlistItem {
  id: number;
  addedAt: string;
  media: {
    id: number;
    tmdbId: number;
    type: string;
    title: string;
    year?: number;
    posterPath?: string;
  };
}

const WatchlistDisplay: React.FC = () => {
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please login first');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${config.backend.baseUrl}/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch watchlist');
      }
      const data: WatchlistItem[] = await response.json();
      setWatchlistItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = async (itemId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${config.backend.baseUrl}/watchlist/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        // Remove from local state
        setWatchlistItems(items => items.filter(item => item.id !== itemId));
      } else {
        setError('Failed to remove item');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  if (loading) {
    return <div className="text-white">Loading watchlist...</div>;
  }

  if (error) {
    return <div className="text-red-400">Error: {error}</div>;
  }

  return (
    <div className="text-white">
      <h3 className="text-xl font-bold mb-4">Your Watchlist ({watchlistItems.length} items)</h3>
      {watchlistItems.length === 0 ? (
        <p className="text-gray-300">No items in your watchlist yet.</p>
      ) : (
        <div className="space-y-4">
          {watchlistItems.map((item) => {
            const posterUrl = item.media.posterPath
              ? `${config.tmdb.imageBaseUrl}${imageSizes.poster.large}${item.media.posterPath}`
              : null;

            return (
              <div key={item.id} className="bg-gray-700 p-4 rounded flex items-start space-x-4">
                {posterUrl && (
                  <img
                    src={posterUrl}
                    alt={item.media.title}
                    className="w-16 h-24 object-cover rounded flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-lg truncate">{item.media.title}</h4>
                  <p className="text-sm text-gray-300 mb-2">
                    TMDB ID: {item.media.tmdbId} | Type: {item.media.type}
                  </p>
                  {item.media.year && (
                    <p className="text-sm text-gray-400 mb-2">
                      Year: {item.media.year}
                    </p>
                  )}
                  <p className="text-sm text-gray-400">
                    Added: {new Date(item.addedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => removeFromWatchlist(item.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WatchlistDisplay;