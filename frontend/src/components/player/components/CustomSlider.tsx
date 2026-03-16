import React, { useCallback, useMemo, useRef, useState } from "react";

export interface CustomSliderProps {
  value: number; // 0-100 (or any range defined by min/max)
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  className?: string;
  "aria-label"?: string;
}

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

export const CustomSlider: React.FC<CustomSliderProps> = ({
  value,
  min = 0,
  max = 100,
  onChange,
  className = "",
  "aria-label": ariaLabel = "Slider",
}) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const normalizedValue = useMemo(
    () => clamp(value, min, max),
    [value, min, max]
  );

  const percentage = useMemo(
    () => ((normalizedValue - min) / (max - min || 1)) * 100,
    [normalizedValue, min, max]
  );

  const updateValueFromClientX = useCallback(
    (clientX: number) => {
      if (!sliderRef.current || !onChange) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percent = clamp(x / rect.width, 0, 1);
      const newValue = min + percent * (max - min);
      onChange(newValue);
    },
    [min, max, onChange]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      updateValueFromClientX(event.clientX);
    },
    [updateValueFromClientX]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!sliderRef.current) return;
      event.stopPropagation();
      setIsDragging(true);
      sliderRef.current.setPointerCapture(event.pointerId);
      updateValueFromClientX(event.clientX);
    },
    [updateValueFromClientX]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      event.stopPropagation();
      event.preventDefault();
      updateValueFromClientX(event.clientX);
    },
    [isDragging, updateValueFromClientX]
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!sliderRef.current) return;
      if (isDragging) {
        sliderRef.current.releasePointerCapture(event.pointerId);
        setIsDragging(false);
      }
    },
    [isDragging]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onChange) return;
      const step = (max - min) / 100 || 1; // 1% step
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onChange(clamp(normalizedValue + step, min, max));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(clamp(normalizedValue - step, min, max));
      }
    },
    [onChange, normalizedValue, min, max]
  );

  return (
    <div
      ref={sliderRef}
      className={`relative w-full h-2 bg-black/90 rounded-full cursor-pointer touch-none ${className}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={normalizedValue}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {/* Filled track (white) */}
      <div
        className="absolute top-0 left-0 bottom-0 bg-white rounded-full"
        style={{ width: `${percentage}%` }}
      />

      {/* Thumb (round vertical rectangle) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-5 bg-white rounded-full pointer-events-none z-10"
        style={{ left: `calc(${percentage}% - 4px)` }}
      />
    </div>
  );
};

export default CustomSlider;
