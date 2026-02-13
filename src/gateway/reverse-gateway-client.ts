/**
 * Reverse Gateway Client
 *
 * Used by device bots (e.g., Raspberry Pi kiosk) to connect OUTBOUND to the SaaS
 * reverse-gateway endpoint. This enables remote access to the bot from mobile apps
 * and the SaaS web chat, even when the bot is behind NAT.
 *
 * The bot's local gateway server (port 18789) continues to handle local kiosk
 * connections. This client bridges RPCs from SaaS to the local gateway.
 */

import WebSocket from "ws";

interface ReverseGatewayConfig {
  /** SaaS API URL (e.g., https://your-saas.example.com) */
  saasUrl: string;
  /** Agent DB ID (Prisma UUID) */
  agentDbId: string;
  /** Gateway token for authentication */
  gatewayToken: string;
  /** Local gateway port to forward RPCs to */
  localGatewayPort?: number;
  /** Callback when an RPC is received from SaaS */
  onRpc?: (
    method: string,
    params: unknown,
  ) => Promise<{ ok: boolean; result?: unknown; error?: { message: string } }>;
}

const RECONNECT_DELAYS = [2000, 5000, 10000, 30000, 60000];
const PING_INTERVAL = 30000;

export class ReverseGatewayClient {
  private ws: WebSocket | null = null;
  private config: ReverseGatewayConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(config: ReverseGatewayConfig) {
    this.config = config;
  }

  /**
   * Connect to the SaaS reverse-gateway endpoint.
   */
  async connect(): Promise<void> {
    this.closed = false;
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Build the WebSocket URL
      const saasUrl = new URL(this.config.saasUrl);
      const wsProtocol = saasUrl.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${saasUrl.host}/api/gateway/device?agentDbId=${encodeURIComponent(this.config.agentDbId)}&token=${encodeURIComponent(this.config.gatewayToken)}`;

      console.log(`[reverse-gateway] Connecting to SaaS: ${saasUrl.host}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        console.log("[reverse-gateway] Connected to SaaS");
        this.reconnectAttempts = 0;
        this.startPing();
        resolve();
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("close", (code, reason) => {
        console.log(`[reverse-gateway] Disconnected: ${code} ${reason?.toString() || ""}`);
        this.stopPing();

        if (!this.closed) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (err) => {
        console.error("[reverse-gateway] WebSocket error:", err.message);
        if (this.reconnectAttempts === 0) {
          reject(err);
        }
      });

      // Timeout the initial connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error("Reverse gateway connection timeout"));
          this.ws?.close();
        }
      }, 15000);
    });
  }

  /**
   * Handle incoming messages from SaaS.
   * SaaS sends RPC requests (type: "req") that the bot must respond to.
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const frame = JSON.parse(data);

      if (frame.type === "req" && this.config.onRpc) {
        // SaaS is sending an RPC to the bot
        try {
          const result = await this.config.onRpc(frame.method, frame.params);
          this.send({
            type: "res",
            id: frame.id,
            ok: result.ok,
            result: result.result,
            error: result.error,
          });
        } catch (err) {
          this.send({
            type: "res",
            id: frame.id,
            ok: false,
            error: { message: err instanceof Error ? err.message : String(err) },
          });
        }
      } else if (frame.type === "ping") {
        this.send({ type: "pong" });
      }
    } catch {
      // ignore malformed messages
    }
  }

  /**
   * Send an event to SaaS (e.g., channel.outbound, tool.audit).
   */
  sendEvent(event: string, payload: unknown): void {
    this.send({ type: "event", event, payload });
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts++;
    console.log(`[reverse-gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      if (this.closed) return;
      this.doConnect().catch((err) => {
        console.error("[reverse-gateway] Reconnect failed:", err.message);
      });
    }, delay);
  }

  /**
   * Disconnect from SaaS.
   */
  disconnect(): void {
    this.closed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
