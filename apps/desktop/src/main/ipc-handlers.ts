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

  // --- Auth (device code flow) ---
  ipcMain.handle("auth:register-device", async (_event, inviteCode: string) => {
    return await auth.registerWithInviteCode(inviteCode);
  });

  ipcMain.handle("auth:poll-status", async (_event, deviceId: string, pairingToken: string) => {
    const result = await auth.pollStatus(deviceId, pairingToken);
    if (result.status === "ACTIVE") {
      store.set("agentMode", "saas");
      await gateway.restart();
    }
    return result;
  });

  ipcMain.handle("auth:logout", async () => {
    auth.logout();
    await gateway.restart();
  });

  ipcMain.handle("auth:session", () => ({
    isAuthenticated: auth.isAuthenticated,
    deviceId: auth.deviceId,
    agentMode: store.get("agentMode", "standalone"),
  }));

  // --- Agents ---
  ipcMain.handle("agents:list", async () => {
    return await auth.fetchAgents();
  });

  ipcMain.handle("agents:select", async (_event, agentId: string) => {
    store.set("selectedAgentId", agentId);
    await gateway.restart();
    return { success: true };
  });

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
