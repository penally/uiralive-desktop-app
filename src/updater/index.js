const { app, BrowserWindow, ipcMain } = require("electron");

let autoUpdater = null;
let mainWindowGetter = null;

function getMainWindow() {
  return mainWindowGetter ? mainWindowGetter() : null;
}

function initUpdater(getWindow) {
  mainWindowGetter = getWindow;

  if (!app.isPackaged) return;

  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (_) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:update-available", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:update-not-available");
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:download-progress", {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:update-downloaded");
    }
  });

  autoUpdater.on("error", (err) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:error", { message: err?.message || String(err) });
    }
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

function setupUpdaterIPC() {
  ipcMain.handle("updater:check", async () => {
    if (!autoUpdater) return { success: false, error: "Updater not available" };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle("updater:download", async () => {
    if (!autoUpdater) return { success: false, error: "Updater not available" };
    try {
      if (process.platform === "darwin") {
        require("electron").shell.openExternal("https://github.com/penally/uiralive-desktop-app/releases/latest");
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send("updater:error", { 
            message: "Opened release in browser. (Mac limits auto-updates for unsigned apps)" 
          });
        }
        return { success: false };
      }

      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle("updater:quitAndInstall", () => {
    if (autoUpdater) {
      autoUpdater.quitAndInstall(false, true);
    } else {
      app.quit();
    }
  });
}

module.exports = { initUpdater, setupUpdaterIPC };
