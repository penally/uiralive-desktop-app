import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MediaDetailModal } from "@/components/media/MediaDetailModal";

const MovieDetailRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const mediaId = id ? Number(id) : NaN;

  if (!id || Number.isNaN(mediaId)) {
    // If the id is invalid, just bounce back to home
    navigate("/");
    return null;
  }

  return (
    <MediaDetailModal
      open
      mediaId={mediaId}
      mediaType="movie"
      onClose={() => navigate(-1)}
    />
  );
};

export default MovieDetailRoute;


