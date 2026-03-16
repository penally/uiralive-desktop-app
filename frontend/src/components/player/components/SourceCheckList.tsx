import React, { useMemo, useCallback } from "react";
import type { ServerConfig } from "../servers/index";
import { t } from "../../../lib/i18n";

export interface SourceCheckListProps {
  serverChecks: {
    name: string;
    status: "pending" | "checking" | "ok" | "fail";
    message?: string;
  }[];
  serverConfigs: ServerConfig[];
}

const tips = [
  "Tip: Some sources work better than others!",
  "Tip: Try a different source if one fails.",
  "Tip: HLS sources usually load faster.",
  "Tip: Having issues? Try refreshing the page.",
  "Tip: Multiple sources means more options!",
  "Tip: The first working source will play automatically.",
  'Tip: Sources with 🤝, or 🔥 are personally made for rayflix.',
  "Tip: We try our best to make sure all sources work, but sometimes they can be down or slow.",
];

const randomTip = tips[Math.floor(Math.random() * tips.length)];

export const SourceCheckList: React.FC<SourceCheckListProps> = ({
  serverChecks,
  serverConfigs,
}) => {
  const enabledServerConfigs = useMemo(
    () => serverConfigs.filter((s) => !s.disabled && s.enabled),
    [serverConfigs]
  );

  const enabledServerChecks = useMemo(
    () =>
      serverChecks.filter((check) => {
        const server = serverConfigs.find((s) => s.name === check.name);
        return server && !server.disabled && server.enabled;
      }),
    [serverChecks, serverConfigs]
  );

  const isFetching = useMemo(
    () =>
      enabledServerChecks.some(
        (c) => c.status === "checking" || c.status === "pending"
      ),
    [enabledServerChecks]
  );

  const getServerOrder = useCallback(
    (serverName: string): number => {
      const server = enabledServerConfigs.find((s) => s.name === serverName);
      return server?.order ?? 0;
    },
    [enabledServerConfigs]
  );

  const getStatusText = useCallback(
    (
      check: {
        name: string;
        status: "pending" | "checking" | "ok" | "fail";
        message?: string;
      },
      serverOrder: number
    ): string => {
      if (check.status === "checking") {
        return t("source.checking");
      }
      if (check.status === "fail") {
        return t("source.failedFetch");
      }
      if (check.status === "ok") {
        return t("source.success");
      }
      return t("source.prioritytext", { count: serverOrder });
    },
    []
  );

  const checksToDisplay =
    enabledServerChecks.length > 0
      ? enabledServerChecks
      : enabledServerConfigs.map((config) => ({
          name: config.name,
          status: "pending" as const,
          message: undefined,
        }));

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div
        className="overflow-y-auto scrollbar-hide"
        style={{
          maxHeight: "calc(3.5 * (3.5rem + 0.5rem))",
          paddingTop: "0.5rem",
          paddingBottom: "0.5rem",
        }}
      >
        <div className="space-y-2 px-1">
          {checksToDisplay.map((check) => {
            const serverOrder = getServerOrder(check.name);
            const statusText = getStatusText(check, serverOrder);

            return (
              <div
                key={check.name}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  check.status === "checking"
                    ? "border-[var(--player-accent)]/30 bg-[var(--player-accent)]/5"
                    : check.status === "fail"
                    ? "border-white/5 bg-white/5 opacity-60"
                    : check.status === "ok"
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-white/5 bg-white/5"
                }`}
              >
                <div className="flex-shrink-0">
                  {check.status === "checking" ? (
                    <div className="relative w-5 h-5">
                      <div className="absolute inset-0 rounded-full border-2 border-white/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
                    </div>
                  ) : check.status === "fail" ? (
                    <div className="w-5 h-5 rounded-full bg-[#F07178] flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 3L3 9M3 3L9 9"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  ) : check.status === "ok" ? (
                    <div className="w-5 h-5 rounded-full bg-[#B9BB25] flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-white/20 bg-transparent" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold transition-colors ${
                        check.status === "checking"
                          ? "text-[var(--player-accent)]"
                          : check.status === "fail"
                          ? "text-red-400"
                          : check.status === "ok"
                          ? "text-green-400"
                          : "text-white"
                      }`}
                    >
                      {check.name}
                    </span>
                  </div>
                  <div className="text-white/60 text-xs mt-0.5">
                    {statusText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {isFetching && (
        <div className="mt-3 text-center">
          <p className="text-white/50 text-xs">{randomTip}</p>
        </div>
      )}
    </div>
  );
};

export default SourceCheckList;
