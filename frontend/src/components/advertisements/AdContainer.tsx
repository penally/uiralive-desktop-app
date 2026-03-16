import React, { useEffect, useMemo } from "react";

type AdVariant = "placeholder" | "standard" | "og";

interface AdContainerProps {
  width?: string;
  className?: string;
  padding?: string;
  href?: string;
  variant?: AdVariant;
}

const variantImages: Record<AdVariant, string> = {
  placeholder: "/ad_placeholder.jpg",
  standard: "/standard.png",
  og: "/og_image.png",
};

const generateRequestId = (): string => {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `ad_${timestamp}_${random}`;
};

export const AdContainer: React.FC<AdContainerProps> = ({
  width = "auto",
  className = "",
  padding = "24px",
  href,
  variant,
}) => {
  const requestId = useMemo(() => generateRequestId(), []);

  const imageSrc = useMemo(
    () => (variant ? variantImages[variant] : null),
    [variant]
  );

  useEffect(() => {
    // Simple telemetry-style console log matching the Svelte version
    console.log("🎯 Ad Rendered:", {
      requestId,
      variant,
      imageSrc,
      href,
      timestamp: new Date().toISOString(),
    });
  }, [href, imageSrc, requestId, variant]);

  const handleAdClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault();

    console.log("🔗 Ad Click:", {
      requestId,
      variant,
      destination: href,
      timestamp: new Date().toISOString(),
    });

    if (href) {
      const apiUrl = new URL("/api/discord", window.location.origin);
      apiUrl.searchParams.set("rid", requestId);
      apiUrl.searchParams.set("dest", href);
      if (variant) {
        apiUrl.searchParams.set("variant", variant);
      }

      window.open(apiUrl.toString(), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`ad-container rounded-xl border-2 border-dashed border-white/20 bg-white/5 relative inline-block mx-auto overflow-hidden ${className}`}
      style={{ width, padding }}
      data-request-id={requestId}
    >
      <div className="absolute top-2 right-2 z-10 rounded bg-black/70 border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-white/70">
        Ad
      </div>

      {imageSrc ? (
        href ? (
          <a href={href} onClick={handleAdClick}>
            <img
              src={imageSrc}
              alt="Ad"
              className="block max-w-full h-auto rounded-lg"
              loading="lazy"
            />
          </a>
        ) : (
          <img
            src={imageSrc}
            alt="Ad"
            className="block max-w-full h-auto rounded-lg"
            loading="lazy"
          />
        )
      ) : (
        <div className="py-5 text-sm text-white/80">No variant provided</div>
      )}
    </div>
  );
};


