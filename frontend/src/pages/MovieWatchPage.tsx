import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import Player from "@/components/player/Player";

const MovieWatchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const movieId = id ? Number(id) : NaN;

  if (!id || Number.isNaN(movieId)) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Player tmdbId={movieId} />
    </div>
  );
};

export default MovieWatchPage;


