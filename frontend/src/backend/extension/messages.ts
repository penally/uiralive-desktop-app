import type { MessagesMetadata } from "@plasmohq/messaging";
import { sendToBackgroundViaRelay } from "@plasmohq/messaging";

import { isAllowedExtensionVersion } from "@/backend/extension/compatibility";
import type { ExtensionMakeRequestResponse } from "@/backend/extension/plasmo";
import { getElectronAPI } from "@/lib/electron";

export const RULE_IDS = {
  PREPARE_STREAM: 1,
  SET_DOMAINS_HLS: 2,
  SET_DOMAINS_HLS_AUDIO: 3,
};

// for some reason, about 500 ms is needed after
// page load before the extension starts responding properly
const isExtensionReady = new Promise<void>((resolve) => {
  setTimeout(() => {
    resolve();
  }, 500);
});

let activeExtension = false;

async function sendMessage<MessageKey extends keyof MessagesMetadata>(
  message: MessageKey,
  payload: MessagesMetadata[MessageKey]["req"] | undefined = undefined,
  timeout: number = -1,
) {
  await isExtensionReady;
  return new Promise<MessagesMetadata[MessageKey]["res"] | null>((resolve) => {
    if (timeout >= 0) setTimeout(() => resolve(null), timeout);
    sendToBackgroundViaRelay<
      MessagesMetadata[MessageKey]["req"],
      MessagesMetadata[MessageKey]["res"]
    >({
      name: message,
      body: payload,
    })
      .then((res) => {
        activeExtension = true;
        resolve(res);
      })
      .catch(() => {
        activeExtension = false;
        resolve(null);
      });
  });
}

export async function sendExtensionRequest<T>(
  ops: MessagesMetadata["makeRequest"]["req"],
): Promise<ExtensionMakeRequestResponse<T> | null> {
  const electron = getElectronAPI();
  if (electron) {
    const res = await electron.makeRequest({
      url: ops.url,
      method: ops.method,
      headers: ops.headers,
      body: ops.body,
      bodyType: ops.bodyType,
    });
    return res as ExtensionMakeRequestResponse<T> | null;
  }
  return sendMessage("makeRequest", ops);
}

export async function setDomainRule(
  ops: MessagesMetadata["prepareStream"]["req"],
): Promise<MessagesMetadata["prepareStream"]["res"] | null> {
  const electron = getElectronAPI();
  if (electron) {
    const res = await electron.setDomainRule({
      targetDomains: ops.targetDomains,
      requestHeaders: ops.requestHeaders,
    });
    return res as MessagesMetadata["prepareStream"]["res"] | null;
  }
  return sendMessage("prepareStream", ops);
}

export async function sendPage(
  ops: MessagesMetadata["openPage"]["req"],
): Promise<MessagesMetadata["openPage"]["res"] | null> {
  const electron = getElectronAPI();
  if (electron) {
    // Electron app: open external links in default browser via main process if needed
    return { success: true as const };
  }
  return sendMessage("openPage", ops);
}

export async function extensionInfo(): Promise<
  MessagesMetadata["hello"]["res"] | null
> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.hello();
    return result as MessagesMetadata["hello"]["res"] | null;
  }
  const message = await sendMessage("hello", undefined, 500);
  return message;
}

export function isExtensionActiveCached(): boolean {
  if (getElectronAPI()) return true;
  return activeExtension;
}

export async function isExtensionActive(): Promise<boolean> {
  const electron = getElectronAPI();
  if (electron) return true;
  const info = await extensionInfo();
  if (!info?.success) return false;
  const allowedVersion = isAllowedExtensionVersion(info.version);
  if (!allowedVersion) return false;
  return info.allowed && info.hasPermission;
}
