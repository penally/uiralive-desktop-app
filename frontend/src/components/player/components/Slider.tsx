import React, { useCallback, useMemo, useRef, useState } from "react";

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  vertical?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 1,
  vertical = false,
  onChange,
  className = "",
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

  const updateValue = useCallback(
    (event: React.MouseEvent | React.PointerEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();

      if (vertical) {
        const y = event.clientY - rect.top;
        const percent = clamp(1 - y / rect.height, 0, 1);
        const newValue = min + percent * (max - min);
        onChange(newValue);
      } else {
        const x = event.clientX - rect.left;
        const percent = clamp(x / rect.width, 0, 1);
        const newValue = min + percent * (max - min);
        onChange(newValue);
      }
    },
    [vertical, min, max, onChange]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      updateValue(event);
    },
    [updateValue]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!sliderRef.current) return;
      event.stopPropagation();
      setIsDragging(true);
      sliderRef.current.setPointerCapture(event.pointerId);
      updateValue(event);
    },
    [updateValue]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !sliderRef.current) return;
      event.stopPropagation();
      event.preventDefault();
      updateValue(event);
    },
    [isDragging, updateValue]
  );

  const handlePointerUp = useCallback(
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
      const step = (max - min) / 100;
      if (
        event.key === "ArrowUp" ||
        (!vertical && event.key === "ArrowRight")
      ) {
        event.preventDefault();
        onChange(clamp(normalizedValue + step, min, max));
      } else if (
        event.key === "ArrowDown" ||
        (!vertical && event.key === "ArrowLeft")
      ) {
        event.preventDefault();
        onChange(clamp(normalizedValue - step, min, max));
      }
    },
    [vertical, normalizedValue, min, max, onChange]
  );

  if (vertical) {
    return (
      <div
        ref={sliderRef}
        className={`w-2 h-24 bg-white/20 rounded-full cursor-pointer relative touch-none ${className}`}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={normalizedValue}
        tabIndex={0}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-[var(--player-accent)] rounded-full transition-all"
          style={{ height: `${percentage}%` }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--player-accent)] rounded-full border-2 border-white shadow-lg transition-all pointer-events-none"
          style={{ bottom: `calc(${percentage}% - 6px)` }}
        />
      </div>
    );
  }

  return (
    <div
      ref={sliderRef}
      className={`w-full h-2 bg-white/20 rounded-full cursor-pointer relative touch-none ${className}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={normalizedValue}
      tabIndex={0}
    >
      <div
        className="absolute top-0 left-0 bottom-0 bg-[var(--player-accent)] rounded-full transition-all"
        style={{ width: `${percentage}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--player-accent)] rounded-full border-2 border-white shadow-lg transition-all pointer-events-none"
        style={{ left: `calc(${percentage}% - 6px)` }}
      />
    </div>
  );
};

export default Slider;
