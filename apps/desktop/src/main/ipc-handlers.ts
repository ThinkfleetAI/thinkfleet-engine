import type { IpcMain, BrowserWindow } from "electron";
import type { GatewayManager } from "./gateway-manager.js";
import type { AuthManager } from "./auth.js";
import type { Store } from "./store.js";
import { app } from "electron";

export function registerIpcHandlers(
  ipcMain: IpcMain,
  gateway: GatewayManager,
  auth: AuthManager,
  store: Store,
  getMainWindow: () => BrowserWindow | null,
): void {
  // --- Gateway ---
  ipcMain.handle("gateway:start", async () => {
    await gateway.start();
    return gateway.status;
  });

  ipcMain.handle("gateway:stop", () => {
    gateway.stop();
    return gateway.status;
  });

  ipcMain.handle("gateway:restart", async () => {
    await gateway.restart();
    return gateway.status;
  });

  ipcMain.handle("gateway:status", () => ({
    status: gateway.status,
    port: gateway.port,
  }));

  ipcMain.handle(
    "gateway:send-message",
    async (_event, agentId: string, message: string, sessionId?: string) => {
      await gateway.sendMessage(agentId, message, sessionId);
    },
  );

  // Forward WebSocket messages from gateway to renderer
  gateway.onStatusChange(() => {
    const ws = gateway.getWebSocket();
    if (ws) {
      ws.removeAllListeners("message");
      ws.on("message", (data) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send("gateway:message", data.toString());
        }
      });
    }
  });

  // --- Auth ---
  ipcMain.handle("auth:login", async (_event, saasUrl: string) => {
    const result = await auth.login(saasUrl);
    store.set("agentMode", "saas");
    // Restart gateway in SaaS mode
    await gateway.restart();
    return result;
  });

  ipcMain.handle("auth:logout", async () => {
    auth.logout();
    await gateway.restart();
  });

  ipcMain.handle("auth:session", () => ({
    isAuthenticated: auth.isAuthenticated,
    saasUrl: auth.saasUrl,
    agentMode: store.get("agentMode", "standalone"),
  }));

  // --- Settings ---
  ipcMain.handle("settings:get", (_event, key: string) => {
    return store.get(key as keyof Store);
  });

  ipcMain.handle("settings:set", async (_event, key: string, value: unknown) => {
    store.set(key as any, value as any);

    // Restart gateway if relevant settings change
    if (key === "gatewayPort" || key === "agentMode") {
      await gateway.restart();
    }
  });

  // --- App ---
  ipcMain.handle("app:version", () => app.getVersion());
}
