import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import Player from "@/components/player/Player";

const TvWatchPage: React.FC = () => {
  const { id, season, episode } = useParams<{
    id: string;
    season: string;
    episode: string;
  }>();
  const navigate = useNavigate();

  const tvId = id ? Number(id) : NaN;
  const seasonNum = season ? Number(season) : NaN;
  const episodeNum = episode ? Number(episode) : NaN;

  if (!id || Number.isNaN(tvId) || Number.isNaN(seasonNum) || Number.isNaN(episodeNum)) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Player tmdbId={tvId} season={seasonNum} episode={episodeNum} />
    </div>
  );
};

export default TvWatchPage;


