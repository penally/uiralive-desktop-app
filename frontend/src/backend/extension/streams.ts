// Note: Update this import path based on your stream provider
// import type { Stream } from "@p-stream/providers";

import { RULE_IDS, setDomainRule } from "@/backend/extension/messages";

// Temporary interface for Stream - replace with actual import when available
interface Stream {
  type: string;
  playlist?: string;
  qualities?: Record<string, { url: string }>;
  headers?: Record<string, string>;
  preferredHeaders?: Record<string, string>;
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return null;
  }
}

function extractDomainsFromStream(stream: Stream): string[] {
  if (stream.type === "hls") {
    return [extractDomain(stream.playlist ?? "")].filter((v): v is string => !!v);
  }
  if (stream.type === "file") {
    return Object.values(stream.qualities ?? {})
      .map((v) => extractDomain(v.url))
      .filter((v): v is string => !!v);
  }
  return [];
}

function buildHeadersFromStream(stream: Stream): Record<string, string> {
  const headers: Record<string, string> = {};
  Object.entries(stream.headers ?? {}).forEach(([key, value]) => {
    headers[key] = value;
  });
  Object.entries(stream.preferredHeaders ?? {}).forEach(([key, value]) => {
    headers[key] = value;
  });
  return headers;
}

export async function prepareStream(stream: Stream) {
  await setDomainRule({
    ruleId: RULE_IDS.PREPARE_STREAM,
    targetDomains: extractDomainsFromStream(stream),
    requestHeaders: buildHeadersFromStream(stream),
  });
}
