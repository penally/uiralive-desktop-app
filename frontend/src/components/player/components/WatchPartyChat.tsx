import React, { useEffect, useRef } from "react";
import { MessageSquare, X } from "lucide-react";
import { Icon } from "@iconify/react";

const PROXY_BASE = "https://meow-one-sigma.vercel.app/?destination=";

function buildProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return url;
    return PROXY_BASE + encodeURIComponent(url);
  } catch {
    return url;
  }
}

function isGifUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    /\.(gif|gifv)(\?|$)/i.test(url) ||
    lower.includes("giphy.com") ||
    lower.includes("tenor.com") ||
    lower.includes("media.tenor.com") ||
    lower.includes("i.giphy.com") ||
    (lower.includes("imgur.com") && (lower.includes(".gif") || lower.includes("/gif/")))
  );
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)];
}

function MessageContent({ text }: { text: string }) {
  const trimmed = text.trim();
  const urls = extractUrls(trimmed);
  const textWithoutUrls = urls.reduce((s, u) => s.replace(u, "").replace(/\s+/g, " ").trim(), trimmed);

  if (urls.length === 0) {
    return <div className="text-sm text-white/90 break-words whitespace-pre-wrap">{text}</div>;
  }

  const embeds = urls.map((url) => {
    const proxyUrl = buildProxyUrl(url);
    if (isGifUrl(url)) {
      return (
        <div key={url} className="mt-1.5 rounded-lg overflow-hidden max-w-full">
          <img
            src={proxyUrl}
            alt="GIF"
            className="max-h-32 max-w-full object-contain rounded"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }
    return (
      <div key={url} className="mt-1.5 rounded-lg overflow-hidden border border-white/10 max-w-full">
        <iframe
          src={proxyUrl}
          title="Embed"
          className="w-full h-40 border-0 rounded"
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  });

  return (
    <div className="space-y-0.5">
      {textWithoutUrls && (
        <div className="text-sm text-white/90 break-words whitespace-pre-wrap">{textWithoutUrls}</div>
      )}
      {embeds}
    </div>
  );
}

export interface ChatMessage {
  userId: string;
  displayName: string;
  avatar: string | null;
  text: string;
  ts: number;
}

export interface WatchPartyChatProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  watchPartyHostId: string | null;
  isSettingsOpen?: boolean;
}

export const WatchPartyChat: React.FC<WatchPartyChatProps> = ({
  isOpen,
  onClose,
  onToggle,
  messages,
  onSendMessage,
  watchPartyHostId,
  isSettingsOpen = false,
}) => {
  const [input, setInput] = React.useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-black/60 backdrop-blur-md border border-white/10 border-r-0 hover:bg-black/70 transition-all"
        style={{
          right: isSettingsOpen ? "336px" : "8px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
        aria-label="Open chat"
      >
        <MessageSquare className="w-5 h-5 text-white/80" />
        <span className="text-white/80 text-sm font-medium">Chat</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-50 w-80 flex flex-col rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden bg-black/40 backdrop-blur-2xl"
      style={{
        right: isSettingsOpen ? "336px" : "8px",
        top: "50%",
        transform: "translateY(-50%)",
        height: "min(420px, 60vh)",
        maxHeight: "calc(100vh - 32px)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white/80" />
          <h3 className="text-white font-semibold text-sm">Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/40 text-sm py-8">
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((msg, i) => {
            const isHost = msg.userId === watchPartyHostId;
            return (
              <div key={`${msg.ts}-${i}`} className="flex gap-2">
                {msg.avatar ? (
                  <img
                    src={msg.avatar}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon icon="solar:user-bold" className="w-3.5 h-3.5 text-white/60" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-medium truncate ${
                        isHost ? "text-[var(--player-accent)]" : "text-white/70"
                      }`}
                    >
                      {msg.displayName}
                    </span>
                    <span className="text-white/40 text-[10px]">{formatTime(msg.ts)}</span>
                  </div>
                  <MessageContent text={msg.text} />
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message or paste GIF/URL..."
            maxLength={500}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--player-accent)]/50 focus:border-[var(--player-accent)]/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-[var(--player-accent)] hover:bg-[var(--player-accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchPartyChat;
