const DiscordRPC = require("discord-rpc");

const clientId = process.env.DISCORD_CLIENT_ID || "1483002076308045895";
const isValidClientId = clientId && /^\d{17,20}$/.test(clientId);

if (isValidClientId) {
  DiscordRPC.register(clientId);
}

const rpc = isValidClientId ? new DiscordRPC.Client({ transport: "ipc" }) : null;
const ACTIVITY_TYPE_WATCHING = 3;

let rpcReady = false;
let loginInFlight = false;
let lastLoginAttempt = 0;
let lastPresence = null;
const LOGIN_RETRY_MS = 10000;
let lastRpcErrorLog = 0;
const RPC_ERROR_LOG_MS = 60000;

function logRpcError(context, error) {
  const message = error?.message ? String(error.message) : String(error);
  if (message.toLowerCase().includes("could not connect")) return;
  const now = Date.now();
  if (now - lastRpcErrorLog < RPC_ERROR_LOG_MS) return;
  lastRpcErrorLog = now;
  console.warn(`Discord RPC ${context} failed:`, error);
}

function setActivityRaw(args) {
  if (!rpc || typeof rpc.request !== "function") return Promise.resolve();
  if (!rpcReady) {
    attemptLogin();
    return Promise.resolve();
  }

  let timestamps;
  if (args.startTimestamp != null || args.endTimestamp != null) {
    const toSec = (v) => {
      if (v == null) return NaN;
      if (v instanceof Date) return Math.round(v.getTime() / 1000);
      const n = Number(v);
      return n > 1e12 ? Math.round(n / 1000) : n;
    };
    let start = toSec(args.startTimestamp);
    let end = toSec(args.endTimestamp);
    if (!Number.isFinite(start) || start < 0) start = NaN;
    if (!Number.isFinite(end) || end < 0) end = NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      timestamps = { start, end };
    } else {
      timestamps = undefined;
    }
  }

  const assets =
    args.largeImageKey || args.largeImageText
      ? {
          large_image: args.largeImageKey,
          large_text: args.largeImageText,
          small_image: args.smallImageKey,
          small_text: args.smallImageText,
        }
      : undefined;

  const activity = {
    type: ACTIVITY_TYPE_WATCHING,
    name: args.name ?? "Uira Live",
    state: args.state ?? undefined,
    details: args.details ?? undefined,
    timestamps,
    assets,
    buttons: args.buttons,
    instance: !!args.instance,
  };

  return rpc
    .request("SET_ACTIVITY", {
      pid: process.pid,
      activity,
    })
    .catch((error) => {
      rpcReady = false;
      logRpcError("request", error);
    });
}

function attemptLogin() {
  if (!rpc || typeof rpc.login !== "function") return Promise.resolve(false);
  if (loginInFlight) return Promise.resolve(false);

  const now = Date.now();
  if (now - lastLoginAttempt < LOGIN_RETRY_MS) return Promise.resolve(false);

  loginInFlight = true;
  lastLoginAttempt = now;

  return rpc
    .login({ clientId })
    .then(() => {
      loginInFlight = false;
      return true;
    })
    .catch((error) => {
      loginInFlight = false;
      rpcReady = false;
      logRpcError("login", error);
      return false;
    });
}

function clearActivitySafe() {
  if (!rpc || typeof rpc.clearActivity !== "function") return Promise.resolve();
  if (!rpcReady) return Promise.resolve();

  return rpc.clearActivity().catch((error) => {
    rpcReady = false;
    logRpcError("clear activity", error);
  });
}

async function setActivity(presence) {
  if (!rpc || !isValidClientId) return;

  lastPresence = presence;

  if (!presence) {
    await clearActivitySafe();
    return;
  }

  const ts = Math.floor(Date.now() / 1000);
  setActivityRaw({
    name: "Uira Live",
    details: presence.details || "Uira Live",
    state: presence.state,
    startTimestamp: presence.startTimestamp ?? ts,
    endTimestamp: presence.endTimestamp,
    largeImageKey: presence.largeImageKey || "logo",
    largeImageText: presence.largeImageText || "Uira Live",
    smallImageKey: presence.smallImageKey,
    smallImageText: presence.smallImageText,
    instance: true,
  });
}

function onReady() {
  console.log("Discord RPC started");
  rpcReady = true;
  loginInFlight = false;
  if (lastPresence) {
    setActivity(lastPresence);
  }
}

function initialize() {
  if (!rpc || !isValidClientId) return;

  rpc.on("ready", onReady);
  rpc.on("connected", onReady);

  attemptLogin();
}

async function destroy() {
  if (rpc) {
    if (rpcReady) {
      await clearActivitySafe();
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    await rpc.destroy().catch(() => {});
    rpcReady = false;
  }
}

module.exports = { setActivity, destroy, initialize };
