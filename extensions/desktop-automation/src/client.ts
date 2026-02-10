/**
 * HTTP client for the desktop automation sidecar.
 */

const DEFAULT_SIDECAR_URL = "http://127.0.0.1:5089";
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ExecuteRequest {
  task: string;
  app_target?: string;
  session_id?: string;
  approval_mode?: "none" | "destructive" | "all";
  timeout_sec?: number;
  screenshot_before?: boolean;
  screenshot_after?: boolean;
}

export interface ExecuteResponse {
  ok: boolean;
  session_id?: string;
  status?: string;
  steps_completed?: number;
  steps_total?: number;
  result?: string;
  error?: string;
  error_code?: string;
  screenshots?: Record<string, string>;
}

export interface PlanRequest {
  task: string;
  app_target?: string;
}

export interface PlanStep {
  step_number: number;
  app: string;
  action_type: string;
  description: string;
  risk_level: string;
  requires_approval: boolean;
}

export interface PlanResponse {
  ok: boolean;
  plan?: PlanStep[];
  estimated_duration_sec?: number;
  apps_involved?: string[];
  error?: string;
}

export interface ScreenshotResponse {
  ok: boolean;
  image?: string;
  width?: number;
  height?: number;
  elements?: Array<Record<string, unknown>>;
  error?: string;
}

export interface StatusResponse {
  ok: boolean;
  platform?: string;
  ready?: boolean;
  version?: string;
  error?: string;
}

export class DesktopAutomationClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: { baseUrl?: string; timeoutMs?: number } = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_SIDECAR_URL;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the sidecar is running and ready.
   */
  async status(): Promise<StatusResponse> {
    try {
      return await this.request<StatusResponse>("GET", "/status");
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `Sidecar not reachable: ${error.message}`
            : "Sidecar not reachable",
      };
    }
  }

  /**
   * Execute a GUI automation task.
   */
  async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    return this.request<ExecuteResponse>("POST", "/execute", req);
  }

  /**
   * Generate an execution plan without executing.
   */
  async plan(req: PlanRequest): Promise<PlanResponse> {
    return this.request<PlanResponse>("POST", "/plan", req);
  }

  /**
   * Capture a screenshot.
   */
  async screenshot(annotateElements = false): Promise<ScreenshotResponse> {
    return this.request<ScreenshotResponse>(
      "GET",
      `/screenshot?annotate_elements=${annotateElements}`,
    );
  }
}

// Singleton client instance
let clientInstance: DesktopAutomationClient | null = null;

export function getClient(options?: {
  baseUrl?: string;
  timeoutMs?: number;
}): DesktopAutomationClient {
  if (!clientInstance || options) {
    clientInstance = new DesktopAutomationClient(options);
  }
  return clientInstance;
}
