import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api/backend";
import { Plus, Check } from "lucide-react";

interface AddToWatchlistProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  posterPath: string | null;
  className?: string;
  variant?: "button" | "icon";
  showLabel?: boolean;
}

export const AddToWatchlist: React.FC<AddToWatchlistProps> = ({
  tmdbId,
  mediaType,
  title,
  year,
  posterPath,
  className = "",
  variant = "button",
  showLabel = true,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const [isAdded, setIsAdded] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (isLoading || isAdded) return;

    setIsLoading(true);

    try {
      const response = await fetch(apiUrl('/api/watchlist'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tmdbId,
          type: mediaType,
          title,
          year,
          posterPath,
        }),
      });

      if (response.ok) {
        setIsAdded(true);
        setMessage("Added to watchlist!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const data = await response.json();
        if (data.error === "Already in watchlist") {
          setIsAdded(true);
          setMessage("Already in watchlist");
        } else {
          setMessage(data.error || "Failed to save");
        }
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Network error");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`relative ${className}`}
        aria-label={isAdded ? "Added to watchlist" : "Add to watchlist"}
      >
        {isAdded ? (
          <Check className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
        {message && (
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/95 text-[#070505] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-lg z-50">
            {message}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`relative flex items-center gap-2 ${className}`}
      aria-label={isAdded ? "Added to watchlist" : "Add to watchlist"}
    >
      {isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
      {showLabel && <span className="hidden sm:inline">{isAdded ? "Added" : "Save"}</span>}
      {message && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/95 text-[#070505] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shadow-lg z-50">
          {message}
        </span>
      )}
    </button>
  );
};
