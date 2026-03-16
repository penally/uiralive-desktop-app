import React, { useEffect, useRef, useState } from "react";

interface HorizontalScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  viewportRef?: React.MutableRefObject<HTMLDivElement | null>;
}

const MIN_THUMB_WIDTH = 48;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const HorizontalScrollArea: React.FC<HorizontalScrollAreaProps> = ({
  children,
  className = "",
  viewportRef,
}) => {
  const localViewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const hideTimeoutRef = useRef<number | null>(null);

  const maxScroll = Math.max(0, scrollWidth - clientWidth);
  const canScroll = maxScroll > 0;

  const thumbWidth = canScroll
    ? Math.max(MIN_THUMB_WIDTH, (clientWidth / scrollWidth) * clientWidth)
    : clientWidth;
  const thumbTravel = Math.max(0, clientWidth - thumbWidth);
  const thumbLeft =
    canScroll && thumbTravel > 0 ? (scrollLeft / maxScroll) * thumbTravel : 0;

  const updateMetrics = () => {
    const viewport = localViewportRef.current;
    if (!viewport) return;
    setScrollLeft(viewport.scrollLeft);
    setClientWidth(viewport.clientWidth);
    setScrollWidth(viewport.scrollWidth);
  };

  const showScrollbarBriefly = () => {
    setIsActive(true);
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsActive(false);
    }, 950);
  };

  useEffect(() => {
    const viewport = localViewportRef.current;
    if (!viewport) return;

    const onScroll = () => {
      updateMetrics();
      showScrollbarBriefly();
    };

    updateMetrics();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateMetrics);

    const resizeObserver = new ResizeObserver(() => updateMetrics());
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateMetrics);
      resizeObserver.disconnect();
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (event: MouseEvent) => {
      const viewport = localViewportRef.current;
      if (!viewport || thumbTravel <= 0 || maxScroll <= 0) return;
      const deltaX = event.clientX - dragStartXRef.current;
      const scrollDelta = (deltaX / thumbTravel) * maxScroll;
      viewport.scrollLeft = clamp(
        dragStartScrollLeftRef.current + scrollDelta,
        0,
        maxScroll
      );
    };

    const onMouseUp = () => {
      setIsDragging(false);
      showScrollbarBriefly();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, { once: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, maxScroll, thumbTravel]);

  const handleThumbMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = scrollLeft;
    setIsDragging(true);
    setIsActive(true);
  };

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !localViewportRef.current || !canScroll) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const nextThumbLeft = clamp(clickPosition - thumbWidth / 2, 0, thumbTravel);
    const ratio = thumbTravel > 0 ? nextThumbLeft / thumbTravel : 0;
    localViewportRef.current.scrollTo({ left: ratio * maxScroll, behavior: "smooth" });
    showScrollbarBriefly();
  };

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={(node) => {
          localViewportRef.current = node;
          if (viewportRef) {
            viewportRef.current = node;
          }
        }}
        className={`hide-native-scrollbar overflow-x-auto ${className}`.trim()}
      >
        {children}
      </div>

      {canScroll && (
        <div
          ref={trackRef}
          className={`mt-2 h-2 w-full rounded-full bg-white/10 transition-opacity duration-300 ${
            isHovering || isDragging || isActive ? "opacity-100" : "opacity-35"
          }`}
          onClick={handleTrackClick}
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r from-white/35 via-white/50 to-white/35 shadow-[0_0_14px_rgba(255,255,255,0.35)] transition-[left,opacity] duration-200 ${
              isDragging ? "opacity-100" : "opacity-95"
            }`}
            style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbLeft}px)` }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  );
};