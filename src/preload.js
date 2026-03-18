const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectronApp: true,
  platform: process.platform,

  extensionActive: true,
  extensionVersion: "1.0.0-electron",

  makeRequest: (opts) => ipcRenderer.invoke("extension:makeRequest", opts),
  setDomainRule: (opts) => ipcRenderer.invoke("extension:setDomainRule", opts),
  hello: () => ipcRenderer.invoke("extension:hello"),

  warpEnable: () => ipcRenderer.invoke("warp:enable"),
  warpDisable: () => ipcRenderer.invoke("warp:disable"),
  warpStatus: () => ipcRenderer.invoke("warp:status"),

  rpcSetActivity: (presence) => ipcRenderer.invoke("rpc:setActivity", presence),
  rpcClear: () => ipcRenderer.invoke("rpc:clear"),

  updaterCheck: () => ipcRenderer.invoke("updater:check"),
  updaterDownload: () => ipcRenderer.invoke("updater:download"),
  updaterQuitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall"),
  updaterOn: (channel, cb) => {
    const handler = (_, ...args) => cb(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
