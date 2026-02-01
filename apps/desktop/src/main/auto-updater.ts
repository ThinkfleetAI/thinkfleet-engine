import { autoUpdater } from "electron-updater";
import type { BrowserWindow } from "electron";

export function setupAutoUpdater(
  getMainWindow: () => BrowserWindow | null,
): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const win = getMainWindow();
    win?.webContents.send("update:available", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const win = getMainWindow();
    win?.webContents.send("update:downloaded", {
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("[auto-updater] Error:", err.message);
  });

  // Check on startup, then every 4 hours
  void autoUpdater.checkForUpdates().catch(() => {});
  setInterval(
    () => void autoUpdater.checkForUpdates().catch(() => {}),
    4 * 60 * 60 * 1000,
  );
}
