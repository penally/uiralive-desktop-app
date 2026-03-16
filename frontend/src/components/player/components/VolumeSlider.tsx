import React from "react";
import type { PlayerState } from "../lib/types";
import CustomSlider from "./CustomSlider";

export interface VolumeSliderProps {
  state: PlayerState;
  onVolumeChange: (volume: number) => void;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  state,
  onVolumeChange,
}) => {
  return (
    <div
      className="flex items-center gap-2 data-volume-control transition-all duration-200 ease-out overflow-visible"
      data-volume-control
      style={{ width: "140px" }}
    >
      <CustomSlider
        value={state.volume * 100}
        min={0}
        max={100}
        onChange={(val) => onVolumeChange(val / 100)}
        className="w-full"
        aria-label="Volume slider"
      />
    </div>
  );
};

export default VolumeSlider;

