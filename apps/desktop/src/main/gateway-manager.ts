import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { app } from "electron";
import WebSocket from "ws";
import type { Store } from "./store.js";

export type GatewayStatus = "stopped" | "starting" | "running" | "failed";

interface GatewayState {
  status: GatewayStatus;
  error?: string;
  port: number;
}

type StatusChangeCallback = (state: GatewayState) => void;

export class GatewayManager {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private state: GatewayState = { status: "stopped", port: 18789 };
  private listeners: StatusChangeCallback[] = [];
  private store: Store;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(store: Store) {
    this.store = store;
    this.state.port = store.get("gatewayPort", 18789) as number;
  }

  get status(): GatewayStatus {
    return this.state.status;
  }

  get port(): number {
    return this.state.port;
  }

  onStatusChange(cb: StatusChangeCallback): void {
    this.listeners.push(cb);
  }

  private setState(patch: Partial<GatewayState>): void {
    Object.assign(this.state, patch);
    for (const cb of this.listeners) {
      cb({ ...this.state });
    }
  }

  async start(): Promise<void> {
    if (this.state.status === "running" || this.state.status === "starting") {
      return;
    }

    this.setState({ status: "starting", error: undefined });

    try {
      await this.spawnGateway();
    } catch (err) {
      this.setState({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  stop(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    this.disconnectWs();

    if (this.process) {
      this.process.removeAllListeners();
      this.process.kill("SIGTERM");
      this.process = null;
    }

    this.setState({ status: "stopped" });
  }

  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  async sendMessage(
    agentId: string,
    message: string,
    sessionId?: string,
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway not connected");
    }

    const rpcMessage = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "chat.send",
      params: {
        agentId,
        message,
        sessionId,
      },
    };

    this.ws.send(JSON.stringify(rpcMessage));
  }

  private async spawnGateway(): Promise<void> {
    const port = this.state.port;

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      NODE_ENV: "production",
    };

    // Ensure a compatible Node (>=22) is first in PATH.
    // Electron may inherit a PATH where an older Node comes first.
    if (!app.isPackaged) {
      const currentPath = env.PATH ?? "";
      // Prepend /opt/homebrew/bin which typically has a modern Node on macOS
      if (process.platform === "darwin" && !currentPath.startsWith("/opt/homebrew/bin")) {
        env.PATH = `/opt/homebrew/bin:${currentPath}`;
      }
    }

    // If SaaS-connected mode, inject credentials
    const mode = this.store.get("agentMode", "standalone") as string;
    if (mode === "saas") {
      const saasUrl = this.store.get("saasUrl") as string | undefined;
      const agentDbId = this.store.get("saasAgentDbId") as string | undefined;
      const gatewayToken = this.store.get("saasGatewayToken") as string | undefined;

      if (saasUrl && agentDbId && gatewayToken) {
        env.THINKFLEET_SAAS_API_URL = saasUrl;
        env.THINKFLEET_AGENT_DB_ID = agentDbId;
        env.THINKFLEET_GATEWAY_TOKEN = gatewayToken;
      }
    }

    // Proxy settings
    const proxyUrl = this.store.get("proxyUrl") as string | undefined;
    const proxyBypass = this.store.get("proxyBypass") as string | undefined;
    if (proxyUrl) {
      env.HTTP_PROXY = proxyUrl;
      env.HTTPS_PROXY = proxyUrl;
    }
    if (proxyBypass) {
      env.NO_PROXY = proxyBypass;
    }

    const { bin, args: binArgs } = this.resolveGatewayCommand();
    this.process = spawn(
      bin,
      [...binArgs, "gateway", "run", "--port", String(port), "--bind", "loopback", "--force", "--allow-unconfigured"],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      },
    );

    // Wait for gateway to be ready by watching stdout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Gateway startup timed out (15s)"));
      }, 15_000);

      const onData = (chunk: Buffer) => {
        const line = chunk.toString();
        // The gateway logs its listen address on startup
        if (line.includes("listening") || line.includes("Gateway ready") || line.includes(`:${port}`)) {
          clearTimeout(timeout);
          this.process?.stdout?.removeListener("data", onData);
          resolve();
        }
      };

      this.process!.stdout?.on("data", onData);

      this.process!.stderr?.on("data", (chunk: Buffer) => {
        console.error("[gateway stderr]", chunk.toString().trim());
      });

      this.process!.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.process!.on("exit", (code) => {
        if (this.state.status === "starting") {
          clearTimeout(timeout);
          reject(new Error(`Gateway exited during startup with code ${code}`));
        }
      });
    });

    // Connect WebSocket
    await this.connectWs();

    this.setState({ status: "running" });

    // Monitor for unexpected exit
    this.process.on("exit", (code) => {
      console.log(`[gateway] Process exited with code ${code}`);
      this.ws?.close();
      this.ws = null;
      this.process = null;
      this.setState({ status: "stopped" });

      // Auto-restart after 3 seconds unless explicitly stopped
      if (code !== 0 && code !== null) {
        this.setState({ status: "failed", error: `Exited with code ${code}` });
        this.restartTimer = setTimeout(() => {
          console.log("[gateway] Auto-restarting after crash...");
          void this.start();
        }, 3000);
      }
    });
  }

  private async connectWs(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://127.0.0.1:${this.state.port}`;
      const token = this.store.get("saasGatewayToken") as string | undefined;

      const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timed out"));
      }, 5000);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on("close", () => {
        this.ws = null;
      });
    });
  }

  private disconnectWs(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private resolveGatewayCommand(): { bin: string; args: string[] } {
    if (process.env.NODE_ENV === "development" || !app.isPackaged) {
      // In dev, use the local tsx binary to run source entry directly (no build needed)
      const repoRoot = path.resolve(app.getAppPath(), "../..");
      const entryTs = path.join(repoRoot, "src/entry.ts");
      const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
      return { bin: tsxBin, args: [entryTs] };
    }

    // In production, use the globally installed CLI binary
    return { bin: "thinkfleet", args: [] };
  }
}
