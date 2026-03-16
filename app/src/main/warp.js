const { app } = require("electron");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { promisify } = require("util");
const { pipeline: streamPipeline } = require("stream");
const pipeline = promisify(streamPipeline);

const PROXY_PORT = 40000;
const PROXY_HOST = "127.0.0.1";
const DATA_DIR = path.join(app.getPath("userData"), "warp");

const WGCF_PATH = path.join(DATA_DIR, process.platform === "win32" ? "wgcf.exe" : "wgcf");
const WIREPROXY_PATH = path.join(DATA_DIR, process.platform === "win32" ? "wireproxy.exe" : "wireproxy");
const WARP_ACCOUNT_PATH = path.join(DATA_DIR, "wgcf-account.toml");
const WARP_PROFILE_PATH = path.join(DATA_DIR, "wgcf-profile.conf");
const WIREPROXY_CONFIG_PATH = path.join(DATA_DIR, "wireproxy.conf");

let wireproxyProcess = null;
let isEnabled = false;

const WGCF_RELEASES_URL = "https://api.github.com/repos/ViRb3/wgcf/releases/latest";
const WIREPROXY_RELEASES_URL = "https://api.github.com/repos/pufferffish/wireproxy/releases/latest";

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Uira-Live-Desktop",
        Accept: "application/json",
      },
    };

    https
      .get(url, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve).catch(reject);
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Uira-Live-Desktop",
      },
    };

    const handleResponse = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, options, handleResponse).on("error", reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      pipeline(res, file).then(resolve).catch(reject);
    };

    https.get(url, options, handleResponse).on("error", reject);
  });
}

function getAssetName(assets, prefix) {
  const platform = process.platform;
  const arch = process.arch;

  let platformStr, archStr;

  if (platform === "win32") {
    platformStr = "windows";
    archStr = arch === "x64" ? "amd64" : arch;
  } else if (platform === "darwin") {
    platformStr = "darwin";
    archStr = arch === "arm64" ? "arm64" : "amd64";
  } else {
    platformStr = "linux";
    archStr = arch === "x64" ? "amd64" : arch;
  }

  const ext = platform === "win32" ? ".exe" : "";
  const patterns = [
    `${prefix}_${platformStr}_${archStr}${ext}`,
    `${prefix}-${platformStr}-${archStr}${ext}`,
    new RegExp(`${prefix}.*${platformStr}.*${archStr}`, "i"),
  ];

  for (const pattern of patterns) {
    const asset = assets.find((a) => {
      if (typeof pattern === "string") {
        return a.name === pattern || a.name.toLowerCase() === pattern.toLowerCase();
      }
      return pattern.test(a.name);
    });
    if (asset) return asset;
  }

  return null;
}

async function ensureWgcf() {
  if (fs.existsSync(WGCF_PATH)) {
    return true;
  }

  console.log("[WARP] Downloading wgcf...");
  try {
    const release = await fetchJson(WGCF_RELEASES_URL);
    const asset = getAssetName(release.assets, "wgcf");

    if (!asset) {
      throw new Error("Could not find wgcf binary for this platform");
    }

    await downloadFile(asset.browser_download_url, WGCF_PATH);

    if (process.platform !== "win32") {
      fs.chmodSync(WGCF_PATH, 0o755);
    }

    console.log("[WARP] wgcf downloaded successfully");
    return true;
  } catch (error) {
    console.error("[WARP] Failed to download wgcf:", error);
    return false;
  }
}

async function ensureWireproxy() {
  if (fs.existsSync(WIREPROXY_PATH)) {
    return true;
  }

  console.log("[WARP] Downloading wireproxy...");
  try {
    const release = await fetchJson(WIREPROXY_RELEASES_URL);
    const asset = getAssetName(release.assets, "wireproxy");

    if (!asset) {
      throw new Error("Could not find wireproxy binary for this platform");
    }

    const isZip = asset.name.endsWith(".zip");
    const isTarGz = asset.name.endsWith(".tar.gz") || asset.name.endsWith(".tgz");

    if (isZip || isTarGz) {
      const tempPath = path.join(DATA_DIR, asset.name);
      await downloadFile(asset.browser_download_url, tempPath);

      if (process.platform === "win32") {
        const extractDir = path.join(DATA_DIR, "wireproxy_extract");
        fs.mkdirSync(extractDir, { recursive: true });

        if (isZip) {
          execSync(`powershell -Command "Expand-Archive -Force '${tempPath}' '${extractDir}'"`, {
            stdio: "pipe",
          });
        } else if (isTarGz) {
          execSync(`tar -xzf "${tempPath}" -C "${extractDir}"`, {
            stdio: "pipe",
          });
        }

        const findBinary = (dir) => {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const fullPath = path.join(dir, f);
            if (f === "wireproxy.exe") {
              return fullPath;
            }
            if (fs.statSync(fullPath).isDirectory()) {
              const found = findBinary(fullPath);
              if (found) return found;
            }
          }
          return null;
        };

        const binaryPath = findBinary(extractDir);
        if (binaryPath) {
          fs.copyFileSync(binaryPath, WIREPROXY_PATH);
        } else {
          throw new Error("wireproxy.exe not found in archive");
        }

        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.unlinkSync(tempPath);
      } else {
        execSync(`tar -xzf "${tempPath}" -C "${DATA_DIR}"`, { stdio: "pipe" });
        fs.unlinkSync(tempPath);

        const files = fs.readdirSync(DATA_DIR);
        const binary = files.find((f) => f === "wireproxy" && !f.includes("."));
        if (!binary) {
          for (const dir of files) {
            const subPath = path.join(DATA_DIR, dir);
            if (fs.statSync(subPath).isDirectory()) {
              const subFiles = fs.readdirSync(subPath);
              if (subFiles.includes("wireproxy")) {
                fs.renameSync(path.join(subPath, "wireproxy"), WIREPROXY_PATH);
                fs.rmSync(subPath, { recursive: true });
                break;
              }
            }
          }
        }
      }
    } else {
      await downloadFile(asset.browser_download_url, WIREPROXY_PATH);
    }

    if (process.platform !== "win32") {
      fs.chmodSync(WIREPROXY_PATH, 0o755);
    }

    console.log("[WARP] wireproxy downloaded successfully");
    return true;
  } catch (error) {
    console.error("[WARP] Failed to download wireproxy:", error);
    return false;
  }
}

async function ensureWarpAccount() {
  if (fs.existsSync(WARP_ACCOUNT_PATH)) {
    return true;
  }

  console.log("[WARP] Registering with Cloudflare WARP...");
  try {
    execSync(`"${WGCF_PATH}" register --accept-tos`, {
      cwd: DATA_DIR,
      stdio: "pipe",
    });
    console.log("[WARP] WARP account registered");
    return true;
  } catch (error) {
    console.error("[WARP] Failed to register WARP account:", error);
    return false;
  }
}

async function ensureWarpProfile() {
  if (fs.existsSync(WARP_PROFILE_PATH)) {
    return true;
  }

  console.log("[WARP] Generating WireGuard profile...");
  try {
    execSync(`"${WGCF_PATH}" generate`, {
      cwd: DATA_DIR,
      stdio: "pipe",
    });
    console.log("[WARP] WireGuard profile generated");
    return true;
  } catch (error) {
    console.error("[WARP] Failed to generate WireGuard profile:", error);
    return false;
  }
}

function generateWireproxyConfig() {
  console.log("[WARP] Generating wireproxy config...");

  const wgProfile = fs.readFileSync(WARP_PROFILE_PATH, "utf-8");

  const lines = wgProfile.split("\n");
  let section = "";
  const config = { Interface: {}, Peer: {} };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      section = trimmed.slice(1, -1);
    } else if (trimmed && section) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length) {
        config[section][key.trim()] = valueParts.join("=").trim();
      }
    }
  }

  const address = config.Interface.Address || "172.16.0.2/32, fd01:db8:1111::2/128";

  const wireproxyConfig = `[Interface]
PrivateKey = ${config.Interface.PrivateKey}
Address = ${address}
DNS = 1.1.1.1
MTU = 1280

[Peer]
PublicKey = ${config.Peer.PublicKey}
Endpoint = ${config.Peer.Endpoint}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25

[Socks5]
BindAddress = ${PROXY_HOST}:${PROXY_PORT}

[http]
BindAddress = ${PROXY_HOST}:${PROXY_PORT + 1}
`;

  fs.writeFileSync(WIREPROXY_CONFIG_PATH, wireproxyConfig);
  console.log("[WARP] wireproxy config generated");
  return true;
}

function startWireproxy() {
  if (wireproxyProcess) {
    console.log("[WARP] wireproxy already running");
    return true;
  }

  console.log("[WARP] Starting wireproxy...");
  try {
    wireproxyProcess = spawn(WIREPROXY_PATH, ["-c", WIREPROXY_CONFIG_PATH], {
      stdio: "pipe",
      windowsHide: true,
    });

    wireproxyProcess.stdout.on("data", (data) => {
      console.log(`[WARP] wireproxy: ${data}`);
    });

    wireproxyProcess.stderr.on("data", (data) => {
      console.error(`[WARP] wireproxy error: ${data}`);
    });

    wireproxyProcess.on("error", (error) => {
      console.error("[WARP] wireproxy process error:", error);
      wireproxyProcess = null;
      isEnabled = false;
    });

    wireproxyProcess.on("exit", (code) => {
      console.log(`[WARP] wireproxy exited with code ${code}`);
      wireproxyProcess = null;
      isEnabled = false;
    });

    isEnabled = true;
    console.log(`[WARP] wireproxy started on ${PROXY_HOST}:${PROXY_PORT}`);
    return true;
  } catch (error) {
    console.error("[WARP] Failed to start wireproxy:", error);
    return false;
  }
}

function stopWireproxy() {
  if (!wireproxyProcess) {
    return true;
  }

  console.log("[WARP] Stopping wireproxy...");
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${wireproxyProcess.pid} /f /t`, { stdio: "pipe" });
    } else {
      wireproxyProcess.kill("SIGTERM");
    }
    wireproxyProcess = null;
    isEnabled = false;
    console.log("[WARP] wireproxy stopped");
    return true;
  } catch (error) {
    console.error("[WARP] Failed to stop wireproxy:", error);
    try {
      wireproxyProcess?.kill("SIGKILL");
    } catch {}
    wireproxyProcess = null;
    isEnabled = false;
    return true;
  }
}

async function enableWarpProxy() {
  try {
    ensureDataDir();

    if (!(await ensureWgcf())) {
      throw new Error("Failed to download wgcf");
    }
    if (!(await ensureWireproxy())) {
      throw new Error("Failed to download wireproxy");
    }

    if (!(await ensureWarpAccount())) {
      throw new Error("Failed to register WARP account");
    }
    if (!(await ensureWarpProfile())) {
      throw new Error("Failed to generate WireGuard profile");
    }

    generateWireproxyConfig();

    if (!startWireproxy()) {
      throw new Error("Failed to start wireproxy");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      success: true,
      proxyHost: PROXY_HOST,
      proxyPort: PROXY_PORT,
      httpProxyPort: PROXY_PORT + 1,
    };
  } catch (error) {
    console.error("[WARP] Failed to enable WARP proxy:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function disableWarpProxy() {
  stopWireproxy();
  return { success: true };
}

function isWarpProxyEnabled() {
  return isEnabled && wireproxyProcess !== null;
}

function getProxyConfig() {
  if (!isWarpProxyEnabled()) {
    return { proxyRules: "" };
  }
  return {
    proxyRules: `socks5://${PROXY_HOST}:${PROXY_PORT}`,
    proxyBypassRules: "<local>",
  };
}

function cleanup() {
  stopWireproxy();
}

module.exports = {
  enableWarpProxy,
  disableWarpProxy,
  isWarpProxyEnabled,
  getProxyConfig,
  cleanup,
  PROXY_HOST,
  PROXY_PORT,
};
