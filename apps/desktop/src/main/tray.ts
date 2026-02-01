import { Tray, Menu, nativeImage, app } from "electron";
import path from "node:path";
import type { GatewayManager } from "./gateway-manager.js";
import type { Store } from "./store.js";

function getTrayIcon(): nativeImage {
  const iconName =
    process.platform === "darwin" ? "tray-iconTemplate.png" : "tray-icon.png";
  const iconPath = path.join(__dirname, "../../assets", iconName);

  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }
    return icon;
  } catch {
    // Fallback: create a simple 16x16 icon
    return nativeImage.createEmpty();
  }
}

export function updateTrayMenu(
  tray: Tray,
  showChatWindow: () => void,
  gateway: GatewayManager,
  store: Store,
): void {
  const status = gateway.status;
  const mode = (store.get("agentMode", "standalone") as string) === "saas"
    ? "SaaS Connected"
    : "Standalone";

  const statusLabel =
    status === "running"
      ? "Gateway: Running"
      : status === "starting"
        ? "Gateway: Starting..."
        : status === "failed"
          ? "Gateway: Failed"
          : "Gateway: Stopped";

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Chat",
      click: showChatWindow,
    },
    { type: "separator" },
    { label: statusLabel, enabled: false },
    { label: `Mode: ${mode}`, enabled: false },
    { label: `Port: ${gateway.port}`, enabled: false },
    { type: "separator" },
    {
      label: status === "running" ? "Restart Gateway" : "Start Gateway",
      click: () => {
        if (status === "running") {
          void gateway.restart();
        } else {
          void gateway.start();
        }
      },
    },
    {
      label: "Stop Gateway",
      enabled: status === "running" || status === "starting",
      click: () => gateway.stop(),
    },
    { type: "separator" },
    {
      label: "Settings...",
      click: showChatWindow, // Settings accessible via the chat window's settings tab
    },
    {
      label: "Launch at Login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: "separator" },
    {
      label: "Quit ThinkFleet",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`ThinkFleet — ${statusLabel}`);
}

export function createTray(
  showChatWindow: () => void,
  gateway: GatewayManager,
  store: Store,
): Tray {
  const tray = new Tray(getTrayIcon());

  updateTrayMenu(tray, showChatWindow, gateway, store);

  // On Windows/Linux, left click opens the chat window
  tray.on("click", () => {
    showChatWindow();
  });

  return tray;
}
