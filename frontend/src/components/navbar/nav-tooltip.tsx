'use client';

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react"

interface NavTooltipProps {
  label: string
  children: ReactNode
  side?: "right" | "top"
  delay?: number
}

export function NavTooltip({
  label,
  children,
  side = "right",
  delay = 500,
}: NavTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }, [delay])

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
      <div
      className="relative inline-flex cursor-pointer"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}

      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-[60] pointer-events-none animate-in fade-in-0 duration-150 ${
            side === "right"
              ? "left-full top-1/2 -translate-y-1/2 ml-2"
              : "bottom-full left-1/2 -translate-x-1/2 mb-2"
          }`}
        >
          <div className="bg-[hsl(var(--tooltip-bg)/0.9)] text-[hsl(var(--tooltip-foreground))] backdrop-blur-lg px-3 py-1.5 rounded-lg text-xs font-medium shadow-xl shadow-black/30 border border-border/20 whitespace-nowrap">
            {label}
          </div>
        </div>
      )}
    </div>
  )
}

