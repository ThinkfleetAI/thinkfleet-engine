/**
 * Desktop Automation Manager
 *
 * Manages the lifecycle of the desktop automation sidecar process.
 * Spawns the Python FastAPI server as a child process and monitors its health.
 */

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { app } from "electron";
import type { Store } from "./store.js";

export type AutomationStatus = "stopped" | "starting" | "running" | "failed" | "unavailable";

interface AutomationState {
  status: AutomationStatus;
  error?: string;
  port: number;
  platform: string;
}

type StatusChangeCallback = (state: AutomationState) => void;

const DEFAULT_PORT = 5089;
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const STARTUP_TIMEOUT_MS = 10_000;

export class DesktopAutomationManager {
  private process: ChildProcess | null = null;
  private state: AutomationState;
  private listeners: StatusChangeCallback[] = [];
  private store: Store;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(store: Store) {
    this.store = store;

    // Determine platform
    const platform =
      process.platform === "win32"
        ? "windows"
        : process.platform === "darwin"
          ? "macos"
          : "unsupported";

    this.state = {
      status: platform === "unsupported" ? "unavailable" : "stopped",
      port: store.get("automationPort", DEFAULT_PORT) as number,
      platform,
    };
  }

  get status(): AutomationStatus {
    return this.state.status;
  }

  get port(): number {
    return this.state.port;
  }

  get platform(): string {
    return this.state.platform;
  }

  onStatusChange(cb: StatusChangeCallback): void {
    this.listeners.push(cb);
  }

  private setState(patch: Partial<AutomationState>): void {
    Object.assign(this.state, patch);
    for (const cb of this.listeners) {
      cb({ ...this.state });
    }
  }

  async start(): Promise<void> {
    if (this.state.platform === "unsupported") {
      this.setState({
        status: "unavailable",
        error: "Desktop automation is only available on Windows and macOS",
      });
      return;
    }

    if (this.state.status === "running" || this.state.status === "starting") {
      return;
    }

    this.setState({ status: "starting", error: undefined });

    try {
      await this.spawnSidecar();
    } catch (err) {
      this.setState({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  stop(): void {
    this.stopHealthCheck();

    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    if (this.process) {
      this.process.removeAllListeners();

      // On Windows, use taskkill for proper cleanup
      if (process.platform === "win32") {
        try {
          spawn("taskkill", ["/F", "/T", "/PID", String(this.process.pid)], {
            detached: true,
            stdio: "ignore",
          });
        } catch {
          this.process.kill("SIGTERM");
        }
      } else {
        this.process.kill("SIGTERM");
      }

      this.process = null;
    }

    this.setState({ status: "stopped" });
  }

  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  private async spawnSidecar(): Promise<void> {
    const port = this.state.port;

    // Find the sidecar script
    // In development: ../../tools/desktop-automation/server.py
    // In production: resources/tools/desktop-automation/server.py
    let sidecarPath: string;

    if (app.isPackaged) {
      sidecarPath = path.join(
        process.resourcesPath,
        "tools",
        "desktop-automation",
        "server.py",
      );
    } else {
      // Development path - relative to the desktop app
      sidecarPath = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "..",
        "tools",
        "desktop-automation",
        "server.py",
      );
    }

    // Find Python executable
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    // Environment variables
    const env = {
      ...process.env,
      DESKTOP_AUTOMATION_PORT: String(port),
      // Pass through LLM credentials if available
      ...(process.env.OPENAI_API_KEY && { OPENAI_API_KEY: process.env.OPENAI_API_KEY }),
      ...(process.env.ANTHROPIC_API_KEY && { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }),
    };

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(pythonCmd, [sidecarPath], {
          env,
          stdio: ["ignore", "pipe", "pipe"],
          detached: false,
        });

        let startupOutput = "";

        this.process.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          startupOutput += text;
          console.log("[automation-sidecar]", text.trim());

          // Check for successful startup
          if (text.includes("Uvicorn running") || text.includes("Application startup complete")) {
            if (this.startupTimer) {
              clearTimeout(this.startupTimer);
              this.startupTimer = null;
            }
            this.setState({ status: "running" });
            this.startHealthCheck();
            resolve();
          }
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          const text = data.toString();
          console.error("[automation-sidecar]", text.trim());
          startupOutput += text;
        });

        this.process.on("error", (err) => {
          this.setState({
            status: "failed",
            error: `Failed to start sidecar: ${err.message}`,
          });
          reject(err);
        });

        this.process.on("exit", (code, signal) => {
          console.log(`[automation-sidecar] exited with code ${code}, signal ${signal}`);

          if (this.state.status === "running") {
            // Unexpected exit - try to restart
            this.setState({
              status: "failed",
              error: `Sidecar exited unexpectedly (code: ${code})`,
            });
          }
        });

        // Startup timeout
        this.startupTimer = setTimeout(() => {
          if (this.state.status === "starting") {
            this.setState({
              status: "failed",
              error: `Sidecar startup timeout. Output: ${startupOutput.slice(-500)}`,
            });
            this.stop();
            reject(new Error("Startup timeout"));
          }
        }, STARTUP_TIMEOUT_MS);
      } catch (err) {
        reject(err);
      }
    });
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();

    this.healthCheckTimer = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${this.state.port}/status`, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        const data = (await response.json()) as { ok: boolean };
        if (!data.ok) {
          throw new Error("Sidecar reported unhealthy status");
        }
      } catch (err) {
        console.error("[automation-sidecar] Health check failed:", err);

        // Only mark as failed if we were running
        if (this.state.status === "running") {
          this.setState({
            status: "failed",
            error: `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Check if the sidecar is reachable (without starting it).
   */
  async checkHealth(): Promise<{ ok: boolean; platform?: string; error?: string }> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.state.port}/status`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      const data = (await response.json()) as { ok: boolean; platform?: string; error?: string };
      return data;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
