require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { app, BrowserWindow, ipcMain, session, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { net } = require("electron");

let warp = null;
try {
  warp = require("./warp.js");
} catch (e) {
  console.error("[WARP] Module failed to load:", e);
}

const updater = require("../updater");
let rpc = null;
try {
  rpc = require("./rpc.js");
} catch (e) {
  console.warn("[RPC] Module failed to load:", e?.message || e);
}

app.commandLine.appendSwitch("disable-ipc-flooding-protection");
app.commandLine.appendSwitch("disable-features", "AutofillServer,TranslateUI,Translate,MediaRouter");
app.commandLine.appendSwitch("disk-cache-size", "52428800");

// Fixes specific to macOS on Silicon to prevent frame/typing lag
if (process.platform === "darwin") {
  app.commandLine.appendSwitch("enable-features", "Metal");
  app.commandLine.appendSwitch("disable-background-timer-throttling"); // Prevent lag when window is in background
}

Menu.setApplicationMenu(null);

if (process.platform === "win32") {
  app.setAppUserModelId("live.uira.app");
}

const isDev = process.argv.includes("--dev");
const isPackaged = app.isPackaged;

function getFrontendUrl() {
  if (isPackaged) {
    return process.env.FRONTEND_URL || "https://mv.uira.live";
  }
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

let mainWindow = null;
const extensionDomains = new Set();
const domainHeaders = new Map();

function createWindow() {
  const isWin = process.platform === "win32";
  const iconName = isWin ? "icon.ico" : "icon.png";
  const iconPath = path.join(__dirname, "..", "..", "build", iconName);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
    },
    title: "Uira Live",
    show: false,
    backgroundColor: "#0c0c0c",
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  const url = getFrontendUrl();
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on("before-input-event", (_, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

ipcMain.handle("extension:makeRequest", async (_, { url, method, headers, body, bodyType }) => {
  try {
    const init = {
      method: method || "GET",
      headers: headers || {},
    };
    if (body && method !== "GET") {
      if (bodyType === "string") {
        init.body = body;
      } else if (bodyType === "object" && typeof body === "object") {
        init.body = JSON.stringify(body);
        init.headers["Content-Type"] = init.headers["Content-Type"] || "application/json";
      }
    }
    const response = await fetch(url, init);
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    const resHeaders = {};
    response.headers.forEach((v, k) => { resHeaders[k] = v; });
    return {
      success: true,
      response: {
        statusCode: response.status,
        headers: resHeaders,
        finalUrl: response.url,
        body: parsed,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "Request failed",
    };
  }
});

ipcMain.handle("extension:setDomainRule", async (_, { targetDomains, requestHeaders }) => {
  for (const d of targetDomains || []) {
    extensionDomains.add(d.toLowerCase());
    domainHeaders.set(d.toLowerCase(), { requestHeaders: requestHeaders || {} });
  }
  return { success: true };
});

ipcMain.handle("extension:hello", async () => {
  return {
    success: true,
    version: "1.0.0-electron",
    allowed: true,
    hasPermission: true,
  };
});

const WARP_STATE_PATH = path.join(app.getPath("userData"), "warp-enabled.json");

function applyWarpProxy() {
  const ses = session.defaultSession;
  if (!warp) {
    ses.setProxy({ proxyRules: "" });
    return;
  }
  const cfg = warp.getProxyConfig();
  if (cfg.proxyRules) {
    ses.setProxy({ proxyRules: cfg.proxyRules, proxyBypassRules: cfg.proxyBypassRules || "<local>" });
  } else {
    ses.setProxy({ proxyRules: "" });
  }
}

ipcMain.handle("warp:enable", async () => {
  if (!warp) {
    return { success: false, error: "WARP module failed to load" };
  }
  const result = await warp.enableWarpProxy();
  if (result.success) {
    applyWarpProxy();
    try {
      fs.writeFileSync(WARP_STATE_PATH, JSON.stringify({ enabled: true }), "utf-8");
    } catch (_) {}
  }
  return result;
});

ipcMain.handle("warp:disable", async () => {
  if (warp) warp.disableWarpProxy();
  applyWarpProxy();
  try {
    fs.unlinkSync(WARP_STATE_PATH);
  } catch (_) {}
  return { success: true };
});

ipcMain.handle("warp:status", async () => {
  if (!warp) {
    return { enabled: false, proxyHost: "127.0.0.1", proxyPort: 40000 };
  }
  const enabled = warp.isWarpProxyEnabled();
  return {
    enabled,
    proxyHost: warp.PROXY_HOST,
    proxyPort: warp.PROXY_PORT,
  };
});

ipcMain.handle("rpc:setActivity", async (_, presence) => {
  if (rpc) rpc.setActivity(presence || null);
});

ipcMain.handle("rpc:clear", async () => {
  if (rpc) rpc.setActivity(null);
});

const CORS_DOMAINS = ["vixsrc.to", "vix-content.net", "vidfast.co", "videasy.co"];

app.whenReady().then(() => {
  const ses = session.defaultSession;

  ses.webRequest.onBeforeSendHeaders({ urls: ["*://*/*"] }, (details, callback) => {
    try {
      const host = new URL(details.url).hostname.toLowerCase();
      const rule = domainHeaders.get(host);
      if (rule?.requestHeaders && Object.keys(rule.requestHeaders).length > 0) {
        const h = { ...details.requestHeaders, ...rule.requestHeaders };
        callback({ requestHeaders: h });
        return;
      }
    } catch (_) {}
    callback({ requestHeaders: details.requestHeaders });
  });

  ses.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
    try {
      const host = new URL(details.url).hostname.toLowerCase();
      if (CORS_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
        const resp = { ...(details.responseHeaders || {}) };
        for (const k of Object.keys(resp)) {
          if (k.toLowerCase().startsWith("access-control-")) delete resp[k];
        }
        resp["access-control-allow-origin"] = ["*"];
        resp["access-control-allow-methods"] = ["GET, HEAD, OPTIONS"];
        resp["access-control-allow-headers"] = ["*"];
        callback({ responseHeaders: resp });
        return;
      }
    } catch (_) {}
    callback({ responseHeaders: details.responseHeaders });
  });

  createWindow();
  updater.setupUpdaterIPC();
  updater.initUpdater(() => mainWindow);
  if (rpc && typeof rpc.initialize === "function") rpc.initialize();

  if (warp) {
    (async () => {
      try {
        if (fs.existsSync(WARP_STATE_PATH)) {
          const data = JSON.parse(fs.readFileSync(WARP_STATE_PATH, "utf-8"));
          if (data.enabled) {
            const result = await warp.enableWarpProxy();
            if (result.success) {
              applyWarpProxy();
            } else {
              fs.unlinkSync(WARP_STATE_PATH);
            }
          }
        }
      } catch (_) {}
    })();
  }
});

app.on("window-all-closed", () => {
  if (warp) warp.cleanup();
  if (rpc) rpc.destroy();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (warp) warp.cleanup();
  if (rpc) rpc.destroy();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
