import { app, BrowserWindow, ipcMain, Tray } from "electron";
import path from "node:path";
import { createTray, updateTrayMenu } from "./tray.js";
import { GatewayManager } from "./gateway-manager.js";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { createStore } from "./store.js";
import { setupAutoUpdater } from "./auto-updater.js";
import { AuthManager } from "./auth.js";

const PROTOCOL = "thinkfleet";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const store = createStore();
const gatewayManager = new GatewayManager(store);
const authManager = new AuthManager(store);

function createChatWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 360,
    minHeight: 400,
    show: false,
    frame: process.platform !== "darwin",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 12, y: 12 } : undefined,
    transparent: false,
    backgroundColor: "#1a1a2e",
    icon: path.join(__dirname, "../../assets/favicon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      // Hide instead of close so the app stays in the tray
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function handleProtocolUrl(url: string): void {
  if (authManager.handleProtocolUrl(url)) {
    // Auth callback handled — restart gateway in SaaS mode
    store.set("agentMode", "saas");
    void gatewayManager.restart();
    // Show the window so user sees success
    createChatWindow();
    mainWindow?.webContents.send("auth:updated");
  }
}

// --- Single instance lock ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // On Windows/Linux, protocol URL comes via argv
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) handleProtocolUrl(url);

    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Register deep link protocol
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]!]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }

    // macOS: handle protocol URL when app is already running
    app.on("open-url", (_event, url) => {
      handleProtocolUrl(url);
    });

    // macOS: hide dock icon in production (tray-only app)
    if (process.platform === "darwin" && app.isPackaged) {
      app.dock?.hide();
    }

    // Register IPC handlers
    registerIpcHandlers(ipcMain, gatewayManager, authManager, store, getMainWindow);

    // Create system tray
    tray = createTray(createChatWindow, gatewayManager, store);

    // Start gateway
    await gatewayManager.start();

    // In dev, auto-open the chat window
    if (!app.isPackaged) {
      createChatWindow();
    }

    // Update tray menu with current status
    gatewayManager.onStatusChange((status) => {
      if (tray) {
        updateTrayMenu(tray, createChatWindow, gatewayManager, store);
      }
      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("gateway:status-changed", status);
      }
    });

    // Setup auto-updater (skip in dev)
    if (app.isPackaged) {
      setupAutoUpdater(getMainWindow);
    }
  });
}

// Prevent app from quitting when all windows are closed (tray app)
app.on("window-all-closed", () => {
  // Do nothing — keep running in tray
});

app.on("before-quit", () => {
  isQuitting = true;
  gatewayManager.stop();
});

// macOS: re-show window when clicking dock icon
app.on("activate", () => {
  createChatWindow();
});
