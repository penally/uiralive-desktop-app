import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SidebarNav } from "@/components/navbar/sidenavbar";

interface ErrorState {
  code?: number;
  title?: string;
  detail?: string;
}

const ErrorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const state = (location.state || {}) as ErrorState;

  const code = state.code ?? 404;
  const title = state.title ?? (code === 404 ? "Page Not found" : `Something Went Wrong`);
  const detail =
    state.detail ??
    `Request: ${location.pathname}\nMethod: GET\nMessage: ${title}`;

  usePageTitle(`${code} • ${title} • Uira.Live`);

  const handleCopy = () => {
    navigator.clipboard.writeText(detail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen">
      <SidebarNav />

      {/* Centered content area */}
      <div className="flex-1 flex items-center justify-center bg-[var(--theme-content)] px-4">
        <div className="max-w-2xl w-full space-y-6">
          {/* Heading */}
          <div className="flex items-baseline justify-center gap-4">
            <span className="text-5xl font-extrabold text-white/90">{code}:</span>
            <h1 className="text-xl sm:text-2xl font-semibold text-white/80">{title}</h1>
          </div>

          {/* Info text */}
          <p className="text-sm sm:text-base text-white/60 text-center">
            If you keep seeing this, copy the error details below and share them with support.
          </p>

          {/* Error details */}
          <div className="relative bg-black/60 border border-white/10 rounded-2xl overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 text-xs text-white/60">
              <span>Error details</span>
              <button
                onClick={handleCopy}
                className="text-white/70 hover:text-white transition-colors text-xs px-2 py-1 rounded"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-xs sm:text-[13px] font-mono text-white/80 whitespace-pre-wrap break-words bg-black/60 text-left">
              {detail}
            </pre>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-full bg-white text-[#070505] text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Go back
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/15 transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;