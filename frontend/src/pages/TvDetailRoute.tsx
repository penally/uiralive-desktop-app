import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MediaDetailModal } from "@/components/media/MediaDetailModal";

const TvDetailRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const mediaId = id ? Number(id) : NaN;

  if (!id || Number.isNaN(mediaId)) {
    navigate("/");
    return null;
  }

  return (
    <MediaDetailModal
      open
      mediaId={mediaId}
      mediaType="tv"
      onClose={() => navigate(-1)}
    />
  );
};

export default TvDetailRoute;


