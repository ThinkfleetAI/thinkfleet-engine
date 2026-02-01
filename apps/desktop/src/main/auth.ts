import { BrowserWindow, shell } from "electron";
import type { Store } from "./store.js";

export class AuthManager {
  private store: Store;
  private authWindow: BrowserWindow | null = null;

  constructor(store: Store) {
    this.store = store;
  }

  get isAuthenticated(): boolean {
    return !!(
      this.store.get("saasUrl") &&
      this.store.get("saasAgentDbId") &&
      this.store.get("saasGatewayToken")
    );
  }

  get saasUrl(): string {
    return this.store.get("saasUrl", "") as string;
  }

  async login(saasUrl: string): Promise<{ agentDbId: string; token: string }> {
    this.store.set("saasUrl", saasUrl);

    return new Promise((resolve, reject) => {
      this.authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // Point to the desktop auth page which handles login + agent selection + token issuance
      const loginUrl = `${saasUrl}/auth/desktop`;
      this.authWindow.loadURL(loginUrl);

      // Listen for redirect to our protocol
      this.authWindow.webContents.on("will-navigate", (_event, url) => {
        this.handleAuthCallback(url, resolve, reject);
      });

      this.authWindow.webContents.on("will-redirect", (_event, url) => {
        this.handleAuthCallback(url, resolve, reject);
      });

      this.authWindow.on("closed", () => {
        this.authWindow = null;
        reject(new Error("Auth window closed by user"));
      });
    });
  }

  private handleAuthCallback(
    url: string,
    resolve: (value: { agentDbId: string; token: string }) => void,
    reject: (err: Error) => void,
  ): void {
    if (!url.startsWith("thinkfleet://auth/callback")) return;

    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get("token");
      const agentDbId = parsed.searchParams.get("agentDbId");

      if (!token || !agentDbId) {
        reject(new Error("Missing token or agentDbId in auth callback"));
        return;
      }

      this.store.set("saasGatewayToken", token);
      this.store.set("saasAgentDbId", agentDbId);

      this.authWindow?.close();
      resolve({ agentDbId, token });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  logout(): void {
    this.store.set("saasUrl", "");
    this.store.set("saasAgentDbId", "");
    this.store.set("saasGatewayToken", "");
    this.store.set("agentMode", "standalone");
  }

  /**
   * Handle the thinkfleet://auth/callback deep link when invoked externally
   */
  handleProtocolUrl(url: string): boolean {
    if (!url.startsWith("thinkfleet://auth/callback")) return false;

    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get("token");
      const agentDbId = parsed.searchParams.get("agentDbId");

      if (token && agentDbId) {
        this.store.set("saasGatewayToken", token);
        this.store.set("saasAgentDbId", agentDbId);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }
}
