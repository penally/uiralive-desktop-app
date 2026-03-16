import React, { useState } from "react"

const LOADING_MESSAGES = [
  "Warming up your experience...",
  "Getting things ready...",
  "Almost there...",
  "Hang tight, loading...",
  "Preparing your workspace...",
  "Just a moment...",
  "Setting things up...",
  "Loading the good stuff...",
]

const LoadingScreen: React.FC = () => {
  const [message] = useState(
    () => LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
  )

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-black via-[#070505] to-black text-white">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(500%); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-0 { animation: fade-up 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .fade-1 { opacity: 0; animation: fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s forwards; }
        .fade-2 { opacity: 0; animation: fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.28s forwards; }
        .shimmer { animation: shimmer 2s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="fade-0 relative">
          <div className="absolute inset-0 rounded-3xl blur-3xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_70%)]" />
          <div
            className="relative flex items-center justify-center w-24 h-24 rounded-3xl backdrop-blur-md"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="text-5xl font-extrabold leading-none select-none"
              style={{ letterSpacing: "0.05em" }}
            >
              U
            </span>
          </div>
        </div>

        {/* Bar */}
        <div
          className="fade-1 overflow-hidden"
          style={{
            width: "14rem",
            height: "3px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="shimmer h-full"
            style={{
              width: "40%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            }}
          />
        </div>

        {/* Message */}
        <p
          className="fade-2 text-xs uppercase"
          style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.18em" }}
        >
          {message}
        </p>

      </div>
    </div>
  )
}

export default LoadingScreen