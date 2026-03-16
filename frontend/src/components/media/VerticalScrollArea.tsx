import React, { useEffect, useRef, useState } from "react";

interface VerticalScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  viewportRef?: React.MutableRefObject<HTMLDivElement | null>;
}

const MIN_THUMB_HEIGHT = 48;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const VerticalScrollArea: React.FC<VerticalScrollAreaProps> = ({
  children,
  className = "",
  viewportRef,
}) => {
  const localViewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);
  const hideTimeoutRef = useRef<number | null>(null);

  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  const canScroll = maxScroll > 0;

  const thumbHeight = canScroll
    ? Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * clientHeight)
    : clientHeight;
  const thumbTravel = Math.max(0, clientHeight - thumbHeight);
  const thumbTop =
    canScroll && thumbTravel > 0 ? (scrollTop / maxScroll) * thumbTravel : 0;

  const updateMetrics = () => {
    const viewport = localViewportRef.current;
    if (!viewport) return;
    setScrollTop(viewport.scrollTop);
    setClientHeight(viewport.clientHeight);
    setScrollHeight(viewport.scrollHeight);
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
      const deltaY = event.clientY - dragStartYRef.current;
      const scrollDelta = (deltaY / thumbTravel) * maxScroll;
      viewport.scrollTop = clamp(
        dragStartScrollTopRef.current + scrollDelta,
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
    dragStartYRef.current = event.clientY;
    dragStartScrollTopRef.current = scrollTop;
    setIsDragging(true);
    setIsActive(true);
  };

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !localViewportRef.current || !canScroll) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickPosition = event.clientY - rect.top;
    const nextThumbTop = clamp(clickPosition - thumbHeight / 2, 0, thumbTravel);
    const ratio = thumbTravel > 0 ? nextThumbTop / thumbTravel : 0;
    localViewportRef.current.scrollTo({ top: ratio * maxScroll, behavior: "smooth" });
    showScrollbarBriefly();
  };

  return (
    <div
      className="relative w-full h-full min-h-0"
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
        className={`hide-native-scrollbar h-full min-h-0 overflow-y-auto ${className}`.trim()}
      >
        {children}
      </div>

      {canScroll && (
        <div
          ref={trackRef}
          className={`absolute right-0 top-0 h-full w-3 transition-opacity duration-300 ${
            isHovering || isDragging || isActive ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleTrackClick}
        >
          <div className="absolute right-1 top-0 h-full w-2 rounded-full bg-white/10">
            <div
              className={`w-full rounded-full bg-gradient-to-b from-white/35 via-white/50 to-white/35 shadow-[0_0_14px_rgba(255,255,255,0.35)] transition-[top,opacity] duration-200 cursor-pointer ${
                isDragging ? "opacity-100" : "opacity-95"
              }`}
              style={{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }}
              onMouseDown={handleThumbMouseDown}
            />
          </div>
        </div>
      )}
    </div>
  );
};