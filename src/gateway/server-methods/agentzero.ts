/**
 * Agent Zero Gateway Handlers
 *
 * Thin HTTP proxy to the local Agent Zero FastAPI gateway at 127.0.0.1:9100.
 * These methods are invoked by the SaaS platform via the existing gateway WS channel.
 *
 * When tasks are created internally (not from SaaS), we also register them with
 * the SaaS platform to ensure they appear on the task board.
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const AZ_HOST = process.env.AZ_GATEWAY_HOST ?? "127.0.0.1";
const AZ_PORT = process.env.AZ_GATEWAY_PORT ?? "9100";
const AZ_BASE = `http://${AZ_HOST}:${AZ_PORT}`;

// SaaS bridge endpoint for task registration
const SAAS_BASE =
  process.env.THINKFLEET_API_URL ||
  process.env.THINKFLEET_PROXY_BASE_URL ||
  process.env.THINKFLEET_PROXY_BASE_URL_LEGACY ||
  "";
const GATEWAY_TOKEN = process.env.THINKFLEET_GATEWAY_TOKEN || "";
const AGENT_DB_ID = process.env.THINKFLEET_AGENT_DB_ID || "";

/**
 * Register an AZ task with the SaaS task board.
 * Best-effort — failures don't block task creation.
 */
async function registerTaskWithSaas(params: {
  taskId: string;
  goal: string;
  constraints?: unknown;
}): Promise<{ saasTaskId?: string }> {
  if (!SAAS_BASE || !GATEWAY_TOKEN || !AGENT_DB_ID) {
    return {}; // SaaS mode not configured
  }
  try {
    const res = await fetch(`${SAAS_BASE}/api/internal/bridge/agentzero`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "X-Agent-Id": AGENT_DB_ID,
      },
      body: JSON.stringify({
        action: "register",
        azTaskId: params.taskId,
        goal: params.goal,
        constraints: params.constraints,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { taskId?: string };
      return { saasTaskId: data.taskId };
    }
  } catch {
    // Best-effort registration — don't fail the AZ task creation
  }
  return {};
}

async function azFetch(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${AZ_BASE}${path}`, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export const agentZeroHandlers: GatewayRequestHandlers = {
  "agentzero.health": async ({ respond }) => {
    try {
      const { ok, data } = await azFetch("/health");
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Agent Zero unhealthy"),
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.create": async ({ respond, params }) => {
    try {
      // Create the task in Agent Zero
      const { ok, data } = await azFetch("/tasks", {
        method: "POST",
        body: params,
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to create task";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }

      // If this task was NOT created via SaaS (no saasTaskId in params), register it
      // with the SaaS task board so it appears in the UI. This handles the case where
      // the AI internally decides to spawn an AZ task (e.g., via MCP or skill).
      const azData = data as { taskId?: string } | null;
      const saasInitiated = Boolean((params as Record<string, unknown>).saasTaskId);
      if (!saasInitiated && azData?.taskId) {
        const goal = (params as Record<string, unknown>).goal as string | undefined;
        const constraints = (params as Record<string, unknown>).constraints;
        // Best-effort registration — don't await in critical path
        void registerTaskWithSaas({
          taskId: azData.taskId,
          goal: goal || "Agent Zero task",
          constraints,
        });
      }

      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.get": async ({ respond, params }) => {
    const taskId = params.taskId;
    if (!taskId || typeof taskId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId is required"));
      return;
    }
    try {
      const { ok, data, status } = await azFetch(`/tasks/${encodeURIComponent(taskId)}`);
      if (!ok) {
        const code = status === 404 ? ErrorCodes.INVALID_REQUEST : ErrorCodes.UNAVAILABLE;
        respond(false, undefined, errorShape(code, "Task not found"));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.cancel": async ({ respond, params }) => {
    const taskId = params.taskId;
    if (!taskId || typeof taskId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId is required"));
      return;
    }
    try {
      const { ok, data } = await azFetch(`/tasks/${encodeURIComponent(taskId)}/cancel`, {
        method: "POST",
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to cancel task";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.settings.update": async ({ respond, params }) => {
    try {
      const { ok, data } = await azFetch("/api/settings_set", {
        method: "POST",
        body: params,
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to update settings";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.memory.export": async ({ respond }) => {
    try {
      const { ok, data } = await azFetch("/api/memory/export", { method: "POST" });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to export memory";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.memory.import": async ({ respond, params }) => {
    try {
      const { ok, data } = await azFetch("/api/memory/import", {
        method: "POST",
        body: params,
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to import memory";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.list": async ({ respond }) => {
    try {
      const { ok, data } = await azFetch("/tasks");
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to list tasks"),
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },
};
