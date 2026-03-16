/**
 * Electron app detection and API bridge.
 * When running in the Electron desktop app, window.electronAPI is exposed via preload.
 */

export interface ElectronAPI {
  isElectronApp: true;
  platform: string;
  extensionActive: true;
  extensionVersion: string;
  warpEnable: () => Promise<{ success: boolean; error?: string; proxyHost?: string; proxyPort?: number }>;
  warpDisable: () => Promise<{ success: boolean }>;
  warpStatus: () => Promise<{ enabled: boolean; proxyHost: string; proxyPort: number }>;
  makeRequest: (opts: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string | Record<string, unknown>;
    bodyType?: "string" | "FormData" | "URLSearchParams" | "object";
  }) => Promise<{
    success: boolean;
    response?: {
      statusCode: number;
      headers: Record<string, string>;
      finalUrl: string;
      body: unknown;
    };
    error?: string;
  }>;
  setDomainRule: (opts: {
    targetDomains: string[];
    requestHeaders?: Record<string, string>;
  }) => Promise<{ success: boolean }>;
  hello: () => Promise<{
    success: boolean;
    version: string;
    allowed: boolean;
    hasPermission: boolean;
  }>;
  updaterCheck: () => Promise<{ success: boolean; error?: string; updateInfo?: unknown }>;
  updaterDownload: () => Promise<{ success: boolean; error?: string }>;
  updaterQuitAndInstall: () => Promise<void>;
  updaterOn: (channel: string, cb: (...args: unknown[]) => void) => () => void;

  rpcSetActivity: (presence: {
    state?: string;
    details?: string;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    startTimestamp?: number;
    endTimestamp?: number;
  } | null) => Promise<void>;
  rpcClear: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function isElectronApp(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.isElectronApp;
}

export function getElectronAPI(): ElectronAPI | null {
  return window.electronAPI ?? null;
}
