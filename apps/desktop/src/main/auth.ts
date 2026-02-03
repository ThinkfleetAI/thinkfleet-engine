import { app } from "electron";
import { hostname, platform, arch } from "node:os";
import type { Store } from "./store.js";

const API_BASE_URL = process.env.THINKFLEET_API_URL || "http://localhost:3002";

export class AuthManager {
  private store: Store;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(store: Store) {
    this.store = store;
  }

  get isAuthenticated(): boolean {
    return !!(this.store.get("deviceId") && this.store.get("deviceAuthToken"));
  }

  get saasUrl(): string {
    return API_BASE_URL;
  }

  get deviceId(): string {
    return this.store.get("deviceId", "") as string;
  }

  get deviceAuthToken(): string {
    return this.store.get("deviceAuthToken", "") as string;
  }

  /**
   * Register device using a 6-character invite code.
   * Returns deviceId and pairingToken for polling.
   */
  async registerWithInviteCode(inviteCode: string): Promise<{ deviceId: string; pairingToken: string }> {
    const res = await fetch(`${API_BASE_URL}/api/assistants/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode: inviteCode.toUpperCase().trim(),
        deviceInfo: {
          hostname: hostname(),
          platform: `${platform()}-${arch()}`,
          hardwareModel: "Desktop App",
          gatewayVersion: app.getVersion(),
          capabilities: ["chat", "display"],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any)?.message || "Invalid or expired invite code");
    }

    const data = await res.json() as { deviceId: string; pairingToken: string };
    this.store.set("deviceId", data.deviceId);
    return data;
  }

  /**
   * Poll for device approval. Returns the status.
   * When approved, stores the auth token and returns config.
   */
  async pollStatus(deviceId: string, pairingToken: string): Promise<{
    status: string;
    authToken: string | null;
    config: Record<string, unknown> | null;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/assistants/devices/poll-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, pairingToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any)?.message || "Poll failed");
    }

    const data = await res.json() as {
      status: string;
      authToken: string | null;
      config: Record<string, unknown> | null;
    };

    if (data.status === "ACTIVE" && data.authToken) {
      this.store.set("deviceAuthToken", data.authToken);
      this.store.set("agentMode", "saas");
      if (data.config?.configVersion) {
        this.store.set("deviceConfigVersion", data.config.configVersion as number);
      }
      if (data.config?.agentId) {
        this.store.set("saasAgentDbId", data.config.agentId as string);
      }
    }

    return data;
  }

  /**
   * Send heartbeat to SaaS.
   */
  async heartbeat(): Promise<{ configVersion: number; needsConfigUpdate: boolean; pendingCommand: string | null }> {
    const res = await fetch(`${API_BASE_URL}/api/assistants/devices/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: this.store.get("deviceId"),
        authToken: this.store.get("deviceAuthToken"),
        health: {
          gatewayStatus: "healthy",
          configVersion: this.store.get("deviceConfigVersion", 0),
        },
      }),
    });

    if (!res.ok) {
      throw new Error("Heartbeat failed");
    }

    return await res.json() as { configVersion: number; needsConfigUpdate: boolean; pendingCommand: string | null };
  }

  /**
   * Fetch all agents in the device's organization.
   */
  async fetchAgents(): Promise<Array<{ id: string; name: string; agentId: string; status: string; avatar: string | null }>> {
    if (!this.isAuthenticated) return [];

    const res = await fetch(`${API_BASE_URL}/api/assistants/devices/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: this.store.get("deviceId"),
        authToken: this.store.get("deviceAuthToken"),
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch agents");
    }

    const data = await res.json() as { agents: Array<{ id: string; name: string; agentId: string; status: string; avatar: string | null }> };
    return data.agents;
  }

  logout(): void {
    this.store.set("deviceId", "");
    this.store.set("deviceAuthToken", "");
    this.store.set("deviceConfigVersion", 0);
    this.store.set("saasUrl", "");
    this.store.set("saasAgentDbId", "");
    this.store.set("saasGatewayToken", "");
    this.store.set("agentMode", "standalone");
  }

  /**
   * Legacy: handle protocol URL callback (kept for compatibility)
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
